import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { accountSchema } from '@mint/shared/schemas/accounts'
import { dashboardSummarySchema } from '@mint/shared/schemas/dashboard'
import { calendarMonthResponseSchema } from '@mint/shared/schemas/forecast'
import { interestResponseSchema } from '@mint/shared/schemas/interest'
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import { scheduleListResponseSchema } from '@mint/shared/schemas/schedules'
import { executeDueOccurrences } from '../execution/execute.js'
import {
  createClient,
  createTestContext,
  createTestUser,
} from '../tests/context.js'
import {
  createAccount,
  signedInClient,
  transferBody,
} from '../tests/fixtures.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

beforeEach(() => {
  context.clock.set(new Date('2026-11-11T10:00:00Z'))
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'interest')
}

async function createLivret(
  user: TestClient,
  overrides: object = {},
): Promise<string> {
  return createAccount(user, {
    name: 'Livret A',
    nature: 'regulated_savings',
    regulatedProduct: 'livret_a',
    usage: 'savings',
    initialBalanceCents: 1_000_000,
    initialBalanceDate: '2026-01-01',
    ...overrides,
  })
}

async function account(user: TestClient, id: string) {
  const overview = await user.get('/accounts/overview')
  const found: unknown = [
    ...overview.body.groups.flatMap(
      (group: { accounts: unknown[] }) => group.accounts,
    ),
    ...overview.body.archived,
  ].find(
    (candidate: unknown) =>
      typeof candidate === 'object' &&
      candidate !== null &&
      'id' in candidate &&
      candidate.id === id,
  )
  return accountSchema.parse(found)
}

function runWorker(today: string) {
  return executeDueOccurrences(
    {
      sequelize: context.dependencies.sequelize,
      models: context.dependencies.models,
    },
    today,
  )
}

describe('LIV-01 deposit caps and interest settings', () => {
  it('prefills the cap from the reference and defaults to fortnights and 31 December, with a hidden interest schedule', async () => {
    const user = await client()
    const livretId = await createLivret(user)

    expect(await account(user, livretId)).toMatchObject({
      depositCapCents: 2_295_000,
      capitalizedInterestCents: 0,
      interestMethod: 'fortnight',
      capitalization: 'dec31',
      anniversaryDate: null,
      depositCapExcessCents: null,
    })
    const schedules = scheduleListResponseSchema.parse(
      (await user.get('/schedules')).body,
    )
    expect(schedules.schedules).toEqual([])
    const systemSchedules = await context.dependencies.models.Schedule.findAll({
      where: { accountId: livretId, isSystem: true },
    })
    expect(
      systemSchedules.map((schedule) => [
        schedule.label,
        schedule.startDate,
        schedule.amountCents,
      ]),
    ).toEqual([['Intérêts', '2026-12-31', 0]])
    expect(
      (
        await user.patch(`/schedules/${systemSchedules[0]?.id ?? ''}`, {
          label: 'Autre',
        })
      ).body,
    ).toEqual({ error: 'system_schedule' })
  })

  it('prefills the cap of the new product, moves the schedule to the anniversary and drops everything for another nature', async () => {
    const user = await client()
    const livretId = await createLivret(user)

    const lep = await user.patch(`/accounts/${livretId}`, {
      regulatedProduct: 'lep',
      capitalization: 'anniversary',
      anniversaryDate: '2020-03-15',
    })
    expect(lep.body).toMatchObject({
      depositCapCents: 1_000_000,
      capitalization: 'anniversary',
      anniversaryDate: '2020-03-15',
    })
    const moved = await context.dependencies.models.Schedule.findOne({
      where: { accountId: livretId, isSystem: true },
    })
    expect(moved?.startDate).toBe('2026-03-15')

    const current = await user.patch(`/accounts/${livretId}`, {
      nature: 'current_account',
      regulatedProduct: null,
      usage: 'current',
    })
    expect(current.body).toMatchObject({
      depositCapCents: null,
      interestMethod: null,
      capitalization: null,
    })
    expect(
      await context.dependencies.models.Schedule.count({
        where: { accountId: livretId },
      }),
    ).toBe(0)
  })

  it('lets the administrator change a reference cap without touching existing accounts', async () => {
    const admin = await createTestUser(context, {
      email: 'caps-admin@example.org',
      role: 'admin',
    })
    const adminClient = createClient(context.server)
    await adminClient.login(admin.email)
    const user = await client()
    const livretId = await createLivret(user)

    const changed = await adminClient.patch('/admin/regulated-caps/livret_a', {
      capCents: 2_300_000,
    })

    expect(changed.status).toBe(200)
    expect(changed.body).toEqual({ product: 'livret_a', capCents: 2_300_000 })
    expect((await user.get('/regulated-caps')).body).toContainEqual({
      product: 'livret_a',
      capCents: 2_300_000,
    })
    expect((await account(user, livretId)).depositCapCents).toBe(2_295_000)
    await adminClient.patch('/admin/regulated-caps/livret_a', {
      capCents: 2_295_000,
    })
  })

  it('deletes a savings account without operations together with its interest schedule', async () => {
    const user = await client()
    const livretId = await createLivret(user)

    expect((await user.delete(`/accounts/${livretId}`)).status).toBe(204)
  })
})

describe('LIV-03 to LIV-05 estimated interest', () => {
  it('shows the interest acquired by completed fortnights and the amount projected on 31 December', async () => {
    const user = await client()
    const livretId = await createLivret(user)
    const rate = await user.post(`/accounts/${livretId}/interest-rates`, {
      effectiveDate: '2025-08-01',
      annualRatePct: 2.4,
    })
    const again = await user.post(`/accounts/${livretId}/interest-rates`, {
      effectiveDate: '2025-08-01',
      annualRatePct: 3,
    })

    expect(rate.status).toBe(201)
    expect(again.body).toEqual({ error: 'interest_rate_exists' })
    expect(
      interestResponseSchema.parse(
        (await user.get(`/accounts/${livretId}/interest`)).body,
      ),
    ).toEqual({
      rates: [
        {
          id: rate.body.id,
          accountId: livretId,
          effectiveDate: '2025-08-01',
          annualRatePct: 2.4,
        },
      ],
      summary: {
        annualRatePct: 2.4,
        periodStart: '2026-01-01',
        acquiredCents: 20_000,
        nextCapitalizationDate: '2026-12-31',
        projectedCents: 24_000,
      },
    })
    expect((await account(user, livretId)).interest?.acquiredCents).toBe(20_000)
  })

  it('generates the estimated interest operation on 31 December, and nothing without a rate', async () => {
    const user = await client()
    const livretId = await createLivret(user)
    const silentId = await createLivret(user, { name: 'LDDS sans taux' })
    await user.post(`/accounts/${livretId}/interest-rates`, {
      effectiveDate: '2025-08-01',
      annualRatePct: 2.4,
    })

    await runWorker('2026-12-31')

    const operations = operationListResponseSchema.parse(
      (await user.get('/operations')).body,
    ).items
    expect(
      operations.map((operation) => [
        operation.accountId,
        operation.date,
        operation.amountCents,
        operation.origin,
        operation.label,
      ]),
    ).toEqual([[livretId, '2026-12-31', 24_000, 'schedule', 'Intérêts']])
    expect(
      await context.dependencies.models.ScheduleOccurrence.count({
        where: { state: 'skipped', originalDate: '2026-12-31' },
      }),
    ).toBeGreaterThanOrEqual(1)
    expect(silentId).not.toBe(livretId)
  })

  it('refuses rates on another nature and on an archived account', async () => {
    const user = await client()
    const currentId = await createAccount(user)
    const livretId = await createLivret(user)
    await user.post(`/accounts/${livretId}/archive`)

    expect((await user.get(`/accounts/${currentId}/interest`)).body).toEqual({
      error: 'account_not_savings',
    })
    expect(
      (
        await user.post(`/accounts/${livretId}/interest-rates`, {
          effectiveDate: '2026-01-01',
          annualRatePct: 2,
        })
      ).body,
    ).toEqual({ error: 'account_archived' })
  })
})

describe('US-15 savings cap (LIV-02)', () => {
  async function lepWithTransfer(user: TestClient) {
    const currentId = await createAccount(user)
    const lepId = await createLivret(user, {
      name: 'LEP',
      regulatedProduct: 'lep',
      usage: 'emergency',
      initialBalanceCents: 995_000,
      initialBalanceDate: '2026-11-01',
    })
    const schedule = await user.post('/schedules', {
      kind: 'transfer',
      label: 'Versement LEP',
      amountCents: 10_000,
      triggerMode: 'auto',
      note: null,
      active: true,
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-12-06',
      anchorLastDay: false,
      endDate: null,
      maxOccurrences: null,
      businessDayRule: 'exact',
      sourceAccountId: currentId,
      targetAccountId: lepId,
    })
    expect(schedule.status).toBe(201)
    return { currentId, lepId, scheduleId: schedule.body.id }
  }

  it('marks the next transfer as exceeding the cap by 50 EUR in the schedule, the calendar and the banner', async () => {
    const user = await client()
    const { lepId, scheduleId } = await lepWithTransfer(user)

    const schedules = scheduleListResponseSchema.parse(
      (await user.get('/schedules')).body,
    )
    expect(
      schedules.schedules.find((schedule) => schedule.id === scheduleId)
        ?.capExcess,
    ).toEqual({
      originalDate: '2026-12-06',
      effectiveDate: '2026-12-06',
      excessCents: 5_000,
    })
    const calendar = calendarMonthResponseSchema.parse(
      (await user.get(`/calendar/2026-12-01?accountId=${lepId}`)).body,
    )
    expect(
      calendar.days.find((day) => day.date === '2026-12-06')?.occurrences,
    ).toEqual([
      expect.objectContaining({ amountCents: 10_000, capExcessCents: 5_000 }),
    ])
    expect(
      dashboardSummarySchema.parse((await user.get('/dashboard/summary')).body)
        .capAlerts,
    ).toEqual([{ accountId: lepId, date: '2026-12-06', excessCents: 5_000 }])
  })

  it('warns without blocking when a recorded transfer takes the balance over the cap', async () => {
    const user = await client()
    const { currentId, lepId } = await lepWithTransfer(user)

    const response = await user.post(
      '/transfers',
      transferBody(currentId, lepId, {
        date: '2026-11-10',
        amountCents: 10_000,
      }),
    )

    expect(response.status).toBe(201)
    expect(response.body.capWarnings).toEqual([
      { accountId: lepId, date: '2026-11-10', excessCents: 5_000 },
    ])
    expect((await account(user, lepId)).depositCapExcessCents).toBe(5_000)
  })
})
