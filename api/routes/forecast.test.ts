import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  balanceCurveResponseSchema,
  calendarMonthResponseSchema,
} from '@mint/shared/schemas/forecast'
import type { CalendarDay } from '@mint/shared/types/forecast'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createSavingsAccount,
  createSchedule,
  envelopeBody,
  expenseScheduleBody,
  signedInClient,
  transferBody,
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
  return signedInClient(context, 'forecast')
}

async function calendar(user: TestClient, month: string, query = '') {
  const response = await user.get(`/calendar/${month}${query}`)
  expect(response.status).toBe(200)
  return calendarMonthResponseSchema.parse(response.body)
}

async function curve(user: TestClient, query = '') {
  const response = await user.get(`/forecast/curve${query}`)
  expect(response.status).toBe(200)
  return balanceCurveResponseSchema.parse(response.body)
}

function day(days: CalendarDay[], date: string): CalendarDay {
  const found = days.find((candidate) => candidate.date === date)
  if (found === undefined) {
    throw new Error(`No day ${date}`)
  }
  return found
}

function onceAt(date: string) {
  return {
    frequency: 'once' as const,
    interval: 1,
    startDate: date,
    endDate: null,
    maxOccurrences: null,
  }
}

async function incomeSchedule(
  user: TestClient,
  accountId: string,
  amountCents: number,
  date: string,
) {
  return createSchedule(user, {
    ...expenseScheduleBody(accountId, await categoryId(user, 'Salaire')),
    kind: 'income',
    isSubscription: undefined,
    label: 'Salaire',
    amountCents,
    ...onceAt(date),
  })
}

describe('CAL-01 to CAL-05 calendar month', () => {
  it('shows the planned occurrences and the forecast balance of each future day (US-12)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const housing = await categoryId(user, 'Logement')
    const expenseId = await createSchedule(user, {
      ...expenseScheduleBody(accountId, housing, { label: 'Dépense' }),
      amountCents: 5_000,
      ...onceAt('2026-11-20'),
    })
    await incomeSchedule(user, accountId, 150_000, '2026-11-28')

    const view = await calendar(user, '2026-11-01', `?accountId=${accountId}`)

    expect(view).toMatchObject({
      today: '2026-11-11',
      accountId,
      thresholdCents: null,
      horizonMonths: 3,
      endDate: '2027-02-11',
      month: '2026-11-01',
      firstMonth: '2026-11-01',
      lastMonth: '2027-02-01',
    })
    expect(view.days).toHaveLength(30)
    expect(day(view.days, '2026-11-19')).toMatchObject({
      period: 'future',
      balanceCents: 100_000,
      occurrences: [],
    })
    expect(day(view.days, '2026-11-20')).toEqual({
      date: '2026-11-20',
      period: 'future',
      balanceCents: 95_000,
      operations: [],
      occurrences: [
        {
          scheduleId: expenseId,
          kind: 'expense',
          label: 'Dépense',
          accountId,
          amountCents: -5_000,
          triggerMode: 'auto',
          isSubscription: false,
          system: false,
          capExcessCents: null,
          occurrence: {
            originalDate: '2026-11-20',
            effectiveDate: '2026-11-20',
            amountCents: 5_000,
            status: 'pending',
            overridden: false,
            editable: true,
          },
        },
      ],
      envelopeShares: [],
    })
    expect(day(view.days, '2026-11-28')).toMatchObject({
      balanceCents: 245_000,
      occurrences: [expect.objectContaining({ amountCents: 150_000 })],
    })
  })

  it('places an annual subscription on its anchor day only (US-06)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await createSchedule(user, {
      ...expenseScheduleBody(
        accountId,
        await categoryId(user, 'Services numériques'),
        { label: 'Abonnement musical', isSubscription: true },
      ),
      amountCents: 4_416,
      frequency: 'yearly',
      startDate: '2027-01-25',
    })

    const december = await calendar(
      user,
      '2026-12-01',
      `?accountId=${accountId}`,
    )
    const january = await calendar(
      user,
      '2027-01-01',
      `?accountId=${accountId}`,
    )

    expect(december.days.flatMap((entry) => entry.occurrences)).toEqual([])
    expect(day(january.days, '2027-01-25').occurrences).toEqual([
      expect.objectContaining({ amountCents: -4_416, isSubscription: true }),
    ])
  })

  it('shows the real operations and end-of-day balance of past days, and today with its forecast balance', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const groceries = await categoryId(user, 'Courses')
    await createOperation(user, accountId, {
      date: '2026-11-05',
      amountCents: -4_500,
      categoryId: groceries,
    })
    await createOperation(user, accountId, {
      date: '2026-11-05',
      amountCents: -500,
    })
    await createOperation(user, accountId, {
      date: '2026-11-11',
      amountCents: -1_000,
    })
    await user.post('/envelopes', {
      ...envelopeBody(accountId, [groceries]),
      monthlyAmountCents: 24_500,
    })

    const view = await calendar(user, '2026-11-01', `?accountId=${accountId}`)

    expect(day(view.days, '2026-11-04')).toMatchObject({
      period: 'past',
      balanceCents: 100_000,
      operations: [],
    })
    expect(day(view.days, '2026-11-05')).toMatchObject({
      period: 'past',
      balanceCents: 95_000,
      occurrences: [],
      envelopeShares: [],
    })
    expect(
      day(view.days, '2026-11-05').operations.map(
        (operation) => operation.amountCents,
      ),
    ).toEqual([-4_500, -500])
    expect(day(view.days, '2026-11-11')).toMatchObject({
      period: 'today',
      balanceCents: 93_000,
      operations: [expect.objectContaining({ amountCents: -1_000 })],
      envelopeShares: [
        expect.objectContaining({ label: 'Courses', amountCents: -1_000 }),
      ],
    })
  })

  it('lists the operations already entered for a future day', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await createOperation(user, accountId, {
      date: '2026-11-15',
      amountCents: -2_000,
      label: 'Future',
    })

    const view = await calendar(user, '2026-11-01', `?accountId=${accountId}`)

    expect(day(view.days, '2026-11-15')).toMatchObject({
      period: 'future',
      balanceCents: 98_000,
      operations: [expect.objectContaining({ label: 'Future' })],
    })
  })

  it('hides the internal transfers from the aggregate view but shows them per account (PRV-05)', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const savings = await createSavingsAccount(user)
    await user.post('/transfers', transferBody(checking, savings))
    await createSchedule(user, {
      kind: 'transfer',
      label: 'Virement épargne',
      amountCents: 10_000,
      triggerMode: 'manual',
      note: null,
      active: true,
      ...onceAt('2026-12-06'),
      anchorLastDay: false,
      businessDayRule: 'exact',
      sourceAccountId: checking,
      targetAccountId: savings,
    })

    const aggregate = await calendar(user, '2026-11-01')
    const aggregateDecember = await calendar(user, '2026-12-01')
    const perAccount = await calendar(
      user,
      '2026-12-01',
      `?accountId=${savings}`,
    )

    expect(day(aggregate.days, '2026-11-06')).toMatchObject({
      balanceCents: 100_000,
      operations: [],
    })
    expect(day(aggregateDecember.days, '2026-12-06').occurrences).toEqual([])
    expect(day(perAccount.days, '2026-12-06')).toMatchObject({
      balanceCents: 20_000,
      occurrences: [
        expect.objectContaining({ amountCents: 10_000, triggerMode: 'manual' }),
      ],
    })
  })

  it('adds only the accounts that already have a balance in the aggregate view', async () => {
    const user = await client()
    await createAccount(user)
    await createAccount(user, {
      name: 'Revolut',
      initialBalanceCents: 50_000,
      initialBalanceDate: '2026-10-15',
    })

    const view = await calendar(user, '2026-10-01')

    expect(view.firstMonth).toBe('2026-10-01')
    expect(day(view.days, '2026-10-14').balanceCents).toBeNull()
    expect(day(view.days, '2026-10-15').balanceCents).toBe(50_000)
    expect(day(view.days, '2026-10-31').balanceCents).toBe(50_000)
  })

  it('stops at the end of the horizon, which the query can change (PRV-06)', async () => {
    const user = await client()
    const accountId = await createAccount(user)

    const view = await calendar(
      user,
      '2026-12-01',
      `?accountId=${accountId}&horizonMonths=1`,
    )

    expect(view).toMatchObject({
      horizonMonths: 1,
      endDate: '2026-12-11',
      lastMonth: '2026-12-01',
    })
    expect(day(view.days, '2026-12-11')).toMatchObject({
      period: 'future',
      balanceCents: 100_000,
    })
    expect(day(view.days, '2026-12-12')).toEqual({
      date: '2026-12-12',
      period: 'beyond',
      balanceCents: null,
      operations: [],
      occurrences: [],
      envelopeShares: [],
    })
  })

  it('refuses a month before the history or after the horizon', async () => {
    const user = await client()
    await createAccount(user)

    const before = await user.get('/calendar/2026-10-01')
    const after = await user.get('/calendar/2027-03-01')
    const notAMonth = await user.get('/calendar/2026-11-02')

    expect(before.status).toBe(400)
    expect(before.body).toEqual({
      error: 'validation_failed',
      issues: [{ path: ['month'], message: 'month_out_of_range' }],
    })
    expect(after.status).toBe(400)
    expect(notAMonth.status).toBe(404)
  })

  it('refuses an archived account and an invalid horizon', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await user.post(`/accounts/${accountId}/archive`)

    const archived = await user.get(
      `/calendar/2026-11-01?accountId=${accountId}`,
    )
    const horizon = await user.get('/calendar/2026-11-01?horizonMonths=13')

    expect(archived.status).toBe(409)
    expect(archived.body).toEqual({ error: 'account_archived' })
    expect(horizon.status).toBe(400)
  })
})

describe('DSH-01 balance curve', () => {
  it('gives 30 real days, then the forecast up to the horizon with its indicators and the threshold of the account', async () => {
    const user = await client()
    const accountId = await createAccount(user, {
      initialBalanceDate: '2026-10-01',
      lowBalanceThresholdCents: 50_000,
    })
    await createOperation(user, accountId, {
      date: '2026-10-20',
      amountCents: -10_000,
    })
    await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement')),
      amountCents: 60_000,
      ...onceAt('2026-12-01'),
    })

    const view = await curve(user, `?accountId=${accountId}`)

    expect(view).toMatchObject({
      today: '2026-11-11',
      accountId,
      thresholdCents: 50_000,
      endDate: '2027-02-11',
      indicators: {
        minBalanceCents: 30_000,
        minBalanceDate: '2026-12-01',
        firstBelowThresholdDate: '2026-12-01',
        firstNegativeDate: null,
      },
    })
    const past = view.points.filter((point) => !point.forecast)
    const future = view.points.filter((point) => point.forecast)
    expect(past).toHaveLength(30)
    expect(past[0]).toEqual({
      date: '2026-10-12',
      balanceCents: 100_000,
      forecast: false,
    })
    expect(
      past.find((point) => point.date === '2026-10-20')?.balanceCents,
    ).toBe(90_000)
    expect(future[0]).toEqual({
      date: '2026-11-11',
      balanceCents: 90_000,
      forecast: true,
    })
    expect(future.at(-1)).toEqual({
      date: '2027-02-11',
      balanceCents: 30_000,
      forecast: true,
    })
  })

  it('shows the aggregate of the active accounts by default, without threshold', async () => {
    const user = await client()
    await createAccount(user, { lowBalanceThresholdCents: 50_000 })
    await createSavingsAccount(user)
    const archived = await createAccount(user, { name: 'Ancien' })
    await user.post(`/accounts/${archived}/archive`)

    const view = await curve(user, '?horizonMonths=2')

    expect(view.accountId).toBeNull()
    expect(view.thresholdCents).toBeNull()
    expect(view.endDate).toBe('2027-01-11')
    expect(view.points.find((point) => point.date === '2026-10-31')).toEqual({
      date: '2026-10-31',
      balanceCents: null,
      forecast: false,
    })
    expect(view.points.find((point) => point.date === '2026-11-01')).toEqual({
      date: '2026-11-01',
      balanceCents: 100_000,
      forecast: false,
    })
    expect(view.indicators?.firstBelowThresholdDate).toBeNull()
  })

  it('has no balance and no indicator without any active account', async () => {
    const user = await client()

    const view = await curve(user)

    expect(view.indicators).toBeNull()
    expect(view.points.every((point) => point.balanceCents === null)).toBe(true)
  })

  it('refuses an unknown account', async () => {
    const user = await client()

    const response = await user.get(
      '/forecast/curve?accountId=00000000-0000-4000-8000-000000000000',
    )

    expect(response.status).toBe(404)
  })
})
