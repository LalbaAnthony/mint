import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  scheduleListResponseSchema,
  scheduleOccurrenceListResponseSchema,
  subscriptionListResponseSchema,
} from '@mint/shared/schemas/schedules'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createPaymentMethod,
  createSavingsAccount,
  createSchedule,
  expenseScheduleBody,
  signedInClient,
} from '../tests/fixtures.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'schedules')
}

async function listSchedules(user: TestClient) {
  return scheduleListResponseSchema.parse((await user.get('/schedules')).body)
}

async function occurrences(user: TestClient, scheduleId: string) {
  return scheduleOccurrenceListResponseSchema.parse(
    (await user.get(`/schedules/${scheduleId}/occurrences`)).body,
  )
}

async function incomeBody(user: TestClient, accountId: string) {
  return {
    ...expenseScheduleBody(accountId, await categoryId(user, 'Salaire'), {
      label: 'Prestation',
      amountCents: 20_000,
      startDate: '2026-11-05',
    }),
    kind: 'income',
    isSubscription: undefined,
  }
}

describe('US-06 annual subscription (ECH-04, ECH-05, ECH-09, ECH-10)', () => {
  it('shows 3.68 EUR per month, a next occurrence on 25 January 2027 and the monthly totals', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const cardId = await createPaymentMethod(user, accountId)

    const response = await user.post(
      '/schedules',
      expenseScheduleBody(null, await categoryId(user, 'Services numériques'), {
        label: 'Musique',
        amountCents: 4_416,
        frequency: 'yearly',
        startDate: '2027-01-25',
        paymentMethodId: cardId,
        isSubscription: true,
      }),
    )

    expect(response.status).toBe(201)
    expect(response.body).toEqual(
      expect.objectContaining({
        kind: 'expense',
        isSubscription: true,
        accountId: null,
        paymentMethodId: cardId,
        monthlyEquivalentCents: 368,
        ended: false,
        nextOccurrence: {
          originalDate: '2027-01-25',
          effectiveDate: '2027-01-25',
          amountCents: 4_416,
          status: 'pending',
          overridden: false,
          editable: true,
        },
      }),
    )
    expect((await listSchedules(user)).totals).toEqual({
      expensesCents: 368,
      incomesCents: 0,
      savingsTransfersCents: 0,
    })
  })
})

describe('US-07 next business day (ECH-06)', () => {
  it('lists the January 2027 rent on Monday 4 January and the February one on Monday 1 February', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(
      user,
      expenseScheduleBody(accountId, await categoryId(user, 'Logement'), {
        businessDayRule: 'next',
      }),
    )

    const listed = await occurrences(user, scheduleId)

    expect(listed.from).toBe('2026-11-11')
    expect(listed.to).toBe('2027-02-11')
    expect(
      listed.occurrences.map(({ originalDate, effectiveDate }) => [
        originalDate,
        effectiveDate,
      ]),
    ).toEqual([
      ['2026-12-01', '2026-12-01'],
      ['2027-01-01', '2027-01-04'],
      ['2027-02-01', '2027-02-01'],
    ])
  })
})

describe('US-08 variable occurrence (ECH-07)', () => {
  it('sets the 5 January 2027 occurrence to 180 EUR without changing the schedule, then restores it', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(
      user,
      await incomeBody(user, accountId),
    )

    const overridden = await user.post(
      `/schedules/${scheduleId}/occurrences/2027-01-05/override`,
      { amountCents: 18_000, effectiveDate: null },
    )
    const listed = await occurrences(user, scheduleId)
    const schedule = (await listSchedules(user)).schedules[0]

    expect(overridden.status).toBe(200)
    expect(overridden.body).toEqual({
      originalDate: '2027-01-05',
      effectiveDate: '2027-01-05',
      amountCents: 18_000,
      status: 'pending',
      overridden: true,
      editable: true,
    })
    expect(listed.occurrences.map((item) => item.amountCents)).toEqual([
      20_000, 18_000, 20_000,
    ])
    expect(schedule?.amountCents).toBe(20_000)

    const restored = await user.delete(
      `/schedules/${scheduleId}/occurrences/2027-01-05`,
    )

    expect(restored.body).toEqual(
      expect.objectContaining({ amountCents: 20_000, overridden: false }),
    )
  })

  it('moves an occurrence to a later date, skips another and restores it', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(
      user,
      await incomeBody(user, accountId),
    )

    const moved = await user.post(
      `/schedules/${scheduleId}/occurrences/2026-12-05/override`,
      { amountCents: null, effectiveDate: '2026-12-12' },
    )
    const skipped = await user.post(
      `/schedules/${scheduleId}/occurrences/2027-01-05/skip`,
    )
    const skippedAgain = await user.post(
      `/schedules/${scheduleId}/occurrences/2027-01-05/skip`,
    )
    const nextAfterSkip = (await listSchedules(user)).schedules[0]
      ?.nextOccurrence

    expect(moved.body.effectiveDate).toBe('2026-12-12')
    expect(skipped.body.status).toBe('skipped')
    expect(skippedAgain.status).toBe(409)
    expect(nextAfterSkip?.originalDate).toBe('2026-12-05')
    expect(
      (await user.delete(`/schedules/${scheduleId}/occurrences/2027-01-05`))
        .body.status,
    ).toBe('pending')
  })

  it('refuses past occurrences, dates not after today, unknown dates and plain restores', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(
      user,
      await incomeBody(user, accountId),
    )

    const past = await user.post(
      `/schedules/${scheduleId}/occurrences/2026-11-05/skip`,
    )
    const toToday = await user.post(
      `/schedules/${scheduleId}/occurrences/2026-12-05/override`,
      { amountCents: null, effectiveDate: '2026-11-11' },
    )
    const unknown = await user.post(
      `/schedules/${scheduleId}/occurrences/2026-12-06/skip`,
    )
    const empty = await user.post(
      `/schedules/${scheduleId}/occurrences/2026-12-05/override`,
      { amountCents: null, effectiveDate: null },
    )
    const plain = await user.delete(
      `/schedules/${scheduleId}/occurrences/2026-12-05`,
    )

    expect(past.body).toEqual({ error: 'occurrence_not_editable' })
    expect(toToday.body.issues).toEqual([
      { path: ['effectiveDate'], message: 'date_not_future' },
    ])
    expect(unknown.status).toBe(404)
    expect(empty.body.issues).toEqual([
      { path: ['amountCents'], message: 'override_empty' },
    ])
    expect(plain.body).toEqual({ error: 'occurrence_not_editable' })
  })
})

describe('ECH-02, ECH-03 validation', () => {
  it('requires a category of the schedule kind and exactly one account or payment method', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const cardId = await createPaymentMethod(user, accountId)

    const wrongKind = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, await categoryId(user, 'Salaire')),
    )
    const both = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, await categoryId(user, 'Logement'), {
        paymentMethodId: cardId,
      }),
    )
    const recurrence = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, await categoryId(user, 'Logement'), {
        frequency: 'weekly',
        anchorLastDay: true,
        endDate: '2026-11-30',
      }),
    )

    expect(wrongKind.body.issues).toEqual([
      { path: ['categoryId'], message: 'category_kind_mismatch' },
    ])
    expect(both.body.issues).toEqual([
      { path: ['accountId'], message: 'payment_or_account_required' },
    ])
    expect(recurrence.body.issues).toEqual([
      { path: ['endDate'], message: 'end_before_start' },
      { path: ['anchorLastDay'], message: 'last_day_not_allowed' },
    ])
  })

  it('refuses archived references and fields of another kind', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const housing = await categoryId(user, 'Logement')
    const scheduleId = await createSchedule(
      user,
      await incomeBody(user, accountId),
    )
    await user.post(`/categories/${housing}/archive`)

    const archivedCategory = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, housing),
    )
    const misplaced = await user.patch(`/schedules/${scheduleId}`, {
      isSubscription: true,
      sourceAccountId: accountId,
    })

    expect(archivedCategory.body).toEqual({ error: 'category_archived' })
    expect(misplaced.body.issues).toEqual([
      { path: ['sourceAccountId'], message: 'not_allowed' },
      { path: ['isSubscription'], message: 'not_allowed' },
    ])
  })
})

describe('ECH-08, ECH-10, ECH-11 modify, list and delete', () => {
  it('removes the exceptions whose original date no longer exists', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(
      user,
      await incomeBody(user, accountId),
    )
    await user.post(`/schedules/${scheduleId}/occurrences/2026-12-05/skip`)
    await user.post(
      `/schedules/${scheduleId}/occurrences/2027-01-05/override`,
      {
        amountCents: 18_000,
        effectiveDate: null,
      },
    )

    const response = await user.patch(`/schedules/${scheduleId}`, {
      startDate: '2026-11-06',
    })

    expect(response.status).toBe(200)
    expect(response.body.removedExceptions).toBe(2)
    expect(response.body.schedule.nextOccurrence.originalDate).toBe(
      '2026-12-06',
    )
  })

  it('totals active savings transfers and leaves inactive or ended schedules out', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)
    const housing = await categoryId(user, 'Logement')
    await createSchedule(user, {
      ...expenseScheduleBody(accountId, housing),
      kind: 'transfer',
      label: 'Epargne',
      amountCents: 10_000,
      accountId: undefined,
      paymentMethodId: undefined,
      categoryId: undefined,
      isSubscription: undefined,
      sourceAccountId: accountId,
      targetAccountId: savingsId,
    })
    const inactiveId = await createSchedule(
      user,
      expenseScheduleBody(accountId, housing),
    )
    await user.patch(`/schedules/${inactiveId}`, { active: false })
    await createSchedule(
      user,
      expenseScheduleBody(accountId, housing, {
        frequency: 'once',
        startDate: '2026-11-02',
      }),
    )

    const listed = await listSchedules(user)

    expect(listed.totals).toEqual({
      expensesCents: 0,
      incomesCents: 0,
      savingsTransfersCents: 10_000,
    })
    expect(
      listed.schedules.map((schedule) => [
        schedule.kind,
        schedule.active,
        schedule.ended,
      ]),
    ).toEqual([
      ['transfer', true, false],
      ['expense', false, false],
      ['expense', true, true],
    ])
    expect((await occurrences(user, inactiveId)).occurrences).toEqual([])
  })

  it('deletes a schedule', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(
      user,
      await incomeBody(user, accountId),
    )

    expect((await user.delete(`/schedules/${scheduleId}`)).status).toBe(204)
    expect((await listSchedules(user)).schedules).toEqual([])
  })
})

describe('ECH-09 subscriptions view', () => {
  async function subscriptions(user: TestClient) {
    const response = await user.get('/subscriptions')
    expect(response.status).toBe(200)
    return subscriptionListResponseSchema.parse(response.body)
  }

  it('lists the active subscriptions by next occurrence with their monthly and annual totals (US-06)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const digital = await categoryId(user, 'Services numériques')
    const music = await createSchedule(
      user,
      expenseScheduleBody(accountId, digital, {
        label: 'Musique',
        amountCents: 4_416,
        frequency: 'yearly',
        startDate: '2027-01-25',
        isSubscription: true,
      }),
    )
    const weekly = await createSchedule(
      user,
      expenseScheduleBody(accountId, digital, {
        label: 'Presse',
        amountCents: 1_000,
        frequency: 'weekly',
        startDate: '2026-11-13',
        isSubscription: true,
      }),
    )
    await createSchedule(
      user,
      expenseScheduleBody(accountId, digital, { label: 'Loyer' }),
    )
    await createSchedule(
      user,
      expenseScheduleBody(accountId, digital, {
        label: 'Ancien',
        isSubscription: true,
        active: false,
      }),
    )

    const view = await subscriptions(user)

    expect(view.subscriptions.map((schedule) => schedule.id)).toEqual([
      weekly,
      music,
    ])
    expect(view.subscriptions[1]).toMatchObject({
      monthlyEquivalentCents: 368,
      nextOccurrence: expect.objectContaining({ effectiveDate: '2027-01-25' }),
    })
    expect(view.totals).toEqual({
      monthlyCents: 368 + 4_333,
      annualCents: 4_416 + 52_000,
    })
  })
})
