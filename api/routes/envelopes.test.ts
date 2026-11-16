import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  envelopeMonthOverrideSchema,
  envelopeMonthResponseSchema,
} from '@mint/shared/schemas/envelopes'
import { calendarMonthResponseSchema } from '@mint/shared/schemas/forecast'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createPaymentMethod,
  createSubcategory,
  envelopeBody,
  readId,
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
  return signedInClient(context, 'envelopes')
}

async function month(user: TestClient, query = '') {
  const response = await user.get(`/envelopes${query}`)
  expect(response.status).toBe(200)
  return envelopeMonthResponseSchema.parse(response.body)
}

async function createEnvelope(user: TestClient, body: object) {
  const response = await user.post('/envelopes', body)
  expect(response.status).toBe(201)
  return readId(response.body)
}

describe('ENV-01 to ENV-06 envelopes of the month', () => {
  it('shows the budget, the consumption of its categories, the available amount and its share per remaining day (US-11)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const groceries = await categoryId(user, 'Courses')
    const drive = await createSubcategory(user, groceries, 'Drive')
    const envelopeId = await createEnvelope(
      user,
      envelopeBody(accountId, [groceries]),
    )
    await createOperation(user, accountId, {
      amountCents: -13_000,
      categoryId: groceries,
    })
    await createOperation(user, accountId, {
      amountCents: 1_000,
      categoryId: drive,
    })
    await createOperation(user, accountId, {
      amountCents: -2_000,
      categoryId: await categoryId(user, 'Loisirs'),
    })

    const view = await month(user)

    expect(view.month).toBe('2026-11-01')
    expect(view.currentMonth).toBe('2026-11-01')
    expect(view.remainingDays).toBe(20)
    expect(view.lines).toEqual([
      {
        envelope: expect.objectContaining({
          id: envelopeId,
          label: 'Courses',
          categoryIds: [groceries],
        }),
        status: {
          budgetCents: 30_000,
          overridden: false,
          carriedOverCents: 0,
          consumedCents: 12_000,
          availableCents: 18_000,
          availablePerDayCents: 900,
        },
      },
    ])
  })

  it('carries the remainder over from the creation month, but not into future months', async () => {
    const user = await client()
    const accountId = await createAccount(user, {
      initialBalanceDate: '2026-09-01',
    })
    const groceries = await categoryId(user, 'Courses')
    const envelopeId = await createEnvelope(
      user,
      envelopeBody(accountId, [groceries], { carryOver: true }),
    )
    await context.dependencies.models.Envelope.update(
      { createdOn: '2026-10-10' },
      { where: { id: envelopeId } },
    )
    await createOperation(user, accountId, {
      date: '2026-10-15',
      amountCents: -25_000,
      categoryId: groceries,
    })

    const november = await month(user)
    const december = await month(user, '?month=2026-12-01')

    expect(november.lines[0]?.status).toEqual(
      expect.objectContaining({
        carriedOverCents: 5_000,
        availableCents: 35_000,
      }),
    )
    expect(december.remainingDays).toBeNull()
    expect(december.lines[0]?.status).toEqual({
      budgetCents: 30_000,
      overridden: false,
      carriedOverCents: 0,
      consumedCents: 0,
      availableCents: 30_000,
      availablePerDayCents: null,
    })
  })

  it('lists inactive envelopes apart and rejects an invalid month', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const envelopeId = await createEnvelope(
      user,
      envelopeBody(accountId, [await categoryId(user, 'Courses')], {
        active: false,
      }),
    )

    const view = await month(user)

    expect(view.lines).toEqual([])
    expect(view.inactive.map((envelope) => envelope.id)).toEqual([envelopeId])
    expect((await user.get('/envelopes?month=2026-11-15')).status).toBe(400)
  })
})

describe('ENV-07 amount of one month', () => {
  it('sets the amount of one month, zero included, used by the view, the carry-over and the forecast', async () => {
    const user = await client()
    const accountId = await createAccount(user, {
      initialBalanceDate: '2026-09-01',
    })
    const groceries = await categoryId(user, 'Courses')
    const envelopeId = await createEnvelope(
      user,
      envelopeBody(accountId, [groceries], { carryOver: true }),
    )
    await context.dependencies.models.Envelope.update(
      { createdOn: '2026-10-10' },
      { where: { id: envelopeId } },
    )
    await createOperation(user, accountId, {
      date: '2026-10-15',
      amountCents: -25_000,
      categoryId: groceries,
    })

    const october = await user.post(
      `/envelopes/${envelopeId}/months/2026-10-01`,
      {
        amountCents: 0,
      },
    )
    const december = await user.post(
      `/envelopes/${envelopeId}/months/2026-12-01`,
      { amountCents: 31_000 },
    )

    expect(october.status).toBe(200)
    expect(envelopeMonthOverrideSchema.parse(october.body)).toEqual({
      envelopeId,
      month: '2026-10-01',
      amountCents: 0,
    })
    expect(december.status).toBe(200)
    expect((await month(user, '?month=2026-10-01')).lines[0]?.status).toEqual(
      expect.objectContaining({
        budgetCents: 0,
        overridden: true,
        availableCents: -25_000,
      }),
    )
    expect((await month(user)).lines[0]?.status).toEqual(
      expect.objectContaining({
        budgetCents: 30_000,
        overridden: false,
        carriedOverCents: -25_000,
        availableCents: 5_000,
      }),
    )
    expect((await month(user, '?month=2026-12-01')).lines[0]?.status).toEqual(
      expect.objectContaining({ budgetCents: 31_000, overridden: true }),
    )
    const calendar = await user.get(
      `/calendar/2026-12-01?accountId=${accountId}`,
    )
    expect(
      calendarMonthResponseSchema
        .parse(calendar.body)
        .days.find((day) => day.date === '2026-12-01')?.envelopeShares,
    ).toEqual([
      expect.objectContaining({ label: 'Courses', amountCents: -1_000 }),
    ])

    const replaced = await user.post(
      `/envelopes/${envelopeId}/months/2026-10-01`,
      { amountCents: 10_000 },
    )

    expect(replaced.body).toEqual(
      expect.objectContaining({ amountCents: 10_000 }),
    )
    expect((await month(user)).lines[0]?.status.carriedOverCents).toBe(-15_000)

    const removed = await user.delete(
      `/envelopes/${envelopeId}/months/2026-10-01`,
    )

    expect(removed.status).toBe(204)
    expect((await month(user)).lines[0]?.status.carriedOverCents).toBe(5_000)
    expect(
      (await user.delete(`/envelopes/${envelopeId}/months/2026-10-01`)).status,
    ).toBe(204)
  })

  it('rejects a negative amount, a day that is not the first of a month and an unknown envelope', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const envelopeId = await createEnvelope(
      user,
      envelopeBody(accountId, [await categoryId(user, 'Courses')]),
    )

    const notFirstDay = await user.post(
      `/envelopes/${envelopeId}/months/2026-12-15`,
      { amountCents: 1_000 },
    )
    const negative = await user.post(
      `/envelopes/${envelopeId}/months/2026-12-01`,
      { amountCents: -1 },
    )
    const unknown = await user.post(
      '/envelopes/00000000-0000-4000-8000-000000000000/months/2026-12-01',
      { amountCents: 1_000 },
    )

    expect(notFirstDay.status).toBe(404)
    expect(negative.status).toBe(400)
    expect(negative.body.issues).toEqual([
      { path: ['amountCents'], message: 'amount_out_of_range' },
    ])
    expect(unknown.status).toBe(404)
  })
})

describe('ENV-08 totals of the month', () => {
  it('adds up the budget, carry-over, consumption and availability of the active envelopes', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const groceries = await categoryId(user, 'Courses')
    const leisure = await categoryId(user, 'Loisirs')
    await createEnvelope(user, envelopeBody(accountId, [groceries]))
    await createEnvelope(
      user,
      envelopeBody(accountId, [leisure], {
        label: 'Sorties',
        monthlyAmountCents: 10_000,
      }),
    )
    await createEnvelope(
      user,
      envelopeBody(accountId, [await categoryId(user, 'Alimentation')], {
        label: 'Inactive',
        active: false,
      }),
    )
    await createOperation(user, accountId, {
      amountCents: -4_000,
      categoryId: groceries,
    })
    await createOperation(user, accountId, {
      amountCents: -12_500,
      categoryId: leisure,
    })

    expect((await month(user)).totals).toEqual({
      budgetCents: 40_000,
      carriedOverCents: 0,
      consumedCents: 16_500,
      availableCents: 23_500,
    })
  })
})

describe('ENV-01 validation', () => {
  it('requires expense categories that belong to no other envelope and one default account', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const cardId = await createPaymentMethod(user, accountId)
    const groceries = await categoryId(user, 'Courses')
    await createEnvelope(user, envelopeBody(accountId, [groceries]))

    const income = await user.post(
      '/envelopes',
      envelopeBody(accountId, [await categoryId(user, 'Salaire')]),
    )
    const taken = await user.post(
      '/envelopes',
      envelopeBody(accountId, [groceries], { label: 'Double' }),
    )
    const both = await user.post(
      '/envelopes',
      envelopeBody(accountId, [await categoryId(user, 'Loisirs')], {
        paymentMethodId: cardId,
      }),
    )

    expect(income.body.issues).toEqual([
      { path: ['categoryIds', 0], message: 'category_kind_mismatch' },
    ])
    expect(taken.body).toEqual({ error: 'category_in_envelope' })
    expect(both.body.issues).toEqual([
      { path: ['accountId'], message: 'payment_or_account_required' },
    ])
  })

  it('modifies the categories of an envelope and deletes it', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const groceries = await categoryId(user, 'Courses')
    const food = await categoryId(user, 'Alimentation')
    const envelopeId = await createEnvelope(
      user,
      envelopeBody(accountId, [groceries]),
    )

    const edited = await user.patch(`/envelopes/${envelopeId}`, {
      categoryIds: [groceries, food],
      monthlyAmountCents: 45_000,
    })
    const reused = await user.post(
      '/envelopes',
      envelopeBody(accountId, [food], { label: 'Autre' }),
    )

    expect(edited.status).toBe(200)
    expect(edited.body).toEqual(
      expect.objectContaining({
        categoryIds: [groceries, food],
        monthlyAmountCents: 45_000,
      }),
    )
    expect(reused.body).toEqual({ error: 'category_in_envelope' })
    expect((await user.delete(`/envelopes/${envelopeId}`)).status).toBe(204)
    expect((await month(user)).lines).toEqual([])
  })
})
