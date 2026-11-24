import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  breakdownResponseSchema,
  dashboardSummarySchema,
  monthlyReportResponseSchema,
} from '@mint/shared/schemas/dashboard'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createSavingsAccount,
  createSchedule,
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
  return signedInClient(context, 'dashboard')
}

describe('DSH-02 spending breakdown', () => {
  it('counts the savings transfers in Save and leaves out adjustments (US-10, US-05)', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const savings = await createSavingsAccount(user)
    const groceries = await categoryId(user, 'Courses')
    const leisure = await categoryId(user, 'Loisirs')
    await createOperation(user, checking, {
      amountCents: -4_500,
      categoryId: groceries,
    })
    await createOperation(user, checking, {
      amountCents: -2_000,
      categoryId: leisure,
    })
    await createOperation(user, checking, { amountCents: -700 })
    await user.post('/transfers', transferBody(checking, savings))
    const statement = await user.post(`/accounts/${checking}/statements`, {
      date: '2026-11-10',
      balanceCents: 90_000,
    })
    await user.post(`/statements/${statement.body.id}/adjust`)

    const response = await user.get('/dashboard/breakdown')

    expect(response.status).toBe(200)
    expect(breakdownResponseSchema.parse(response.body)).toEqual({
      from: '2026-11-01',
      to: '2026-11-30',
      needs: {
        totalCents: 4_500,
        categories: [{ categoryId: groceries, totalCents: 4_500 }],
      },
      wants: {
        totalCents: 2_000,
        categories: [{ categoryId: leisure, totalCents: 2_000 }],
      },
      saveCents: 10_000,
      toCategorizeCents: 700,
      targets: { needs: 50, wants: 30, save: 20 },
    })
  })

  it('accepts a custom period and refuses an inverted one', async () => {
    const user = await client()

    const custom = await user.get(
      '/dashboard/breakdown?from=2026-10-01&to=2026-10-31',
    )
    const inverted = await user.get(
      '/dashboard/breakdown?from=2026-11-30&to=2026-11-01',
    )

    expect(custom.body).toMatchObject({ from: '2026-10-01', to: '2026-10-31' })
    expect(inverted.status).toBe(400)
  })
})

describe('DSH-03 incomes and expenses per month', () => {
  it('gives 12 real months, completes the current month with its planned rest and excludes transfers (US-10)', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const savings = await createSavingsAccount(user)
    await createOperation(user, checking, {
      amountCents: -4_500,
      categoryId: await categoryId(user, 'Courses'),
    })
    await user.post('/transfers', transferBody(checking, savings))
    await createSchedule(user, {
      ...expenseScheduleBody(checking, await categoryId(user, 'Logement')),
      startDate: '2026-11-20',
    })
    await createSchedule(user, {
      kind: 'transfer',
      label: 'Epargne',
      amountCents: 10_000,
      triggerMode: 'manual',
      note: null,
      active: true,
      frequency: 'monthly',
      interval: 1,
      startDate: '2026-11-25',
      anchorLastDay: false,
      endDate: null,
      maxOccurrences: null,
      businessDayRule: 'exact',
      sourceAccountId: checking,
      targetAccountId: savings,
    })

    const response = monthlyReportResponseSchema.parse(
      (await user.get('/dashboard/monthly?horizonMonths=2')).body,
    )

    expect(response.currentMonth).toBe('2026-11-01')
    expect(response.months.map((month) => month.month)).toEqual([
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ])
    expect(response.months.at(-3)).toEqual({
      month: '2026-11-01',
      real: { incomeCents: 0, expenseCents: 4_500 },
      planned: { incomeCents: 0, expenseCents: 60_000 },
      balanceCents: -64_500,
    })
    expect(response.months.at(-2)?.planned.expenseCents).toBe(60_000)
  })
})

describe('DSH-04 dashboard banner', () => {
  it('gives the accounts going below their threshold within 7 days and the counters', async () => {
    const user = await client()
    const checking = await createAccount(user, {
      lowBalanceThresholdCents: 50_000,
    })
    await createSavingsAccount(user)
    await createOperation(user, checking, { amountCents: -700 })
    await createSchedule(user, {
      ...expenseScheduleBody(checking, await categoryId(user, 'Logement')),
      startDate: '2026-11-16',
    })
    await createSchedule(user, {
      ...expenseScheduleBody(checking, await categoryId(user, 'Logement'), {
        label: 'Plus tard',
      }),
      amountCents: 1_000,
      startDate: '2026-11-25',
    })

    const summary = dashboardSummarySchema.parse(
      (await user.get('/dashboard/summary')).body,
    )

    expect(summary).toEqual({
      capAlerts: [],
      alerts: [
        {
          accountId: checking,
          firstBelowThresholdDate: '2026-11-16',
          minBalanceCents: 39_300,
          thresholdCents: 50_000,
        },
      ],
      manualPaymentsCount: 0,
      nextManualPayment: null,
      toCategorizeCount: 1,
      pendingProposalsCount: 0,
      pendingImportIds: [],
    })
  })

  it('counts the manual payments due within the reminder delay of their schedule (NOTIF-02)', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const savings = await createSavingsAccount(user)
    const closed = await createAccount(user, { name: 'Compte clos' })
    const housing = await categoryId(user, 'Logement')
    const manualExpense = (
      accountId: string,
      startDate: string,
      reminderDaysBefore: number,
    ) =>
      createSchedule(user, {
        ...expenseScheduleBody(accountId, housing, {
          triggerMode: 'manual',
          frequency: 'once',
          startDate,
        }),
        reminderDaysBefore,
      })
    await manualExpense(checking, '2026-11-11', 0)
    await manualExpense(checking, '2026-11-13', 2)
    await manualExpense(checking, '2026-11-14', 2)
    const skipped = await manualExpense(checking, '2026-11-12', 2)
    await user.post(`/schedules/${skipped}/occurrences/2026-11-12/skip`)
    await manualExpense(closed, '2026-11-12', 2)
    await user.post(`/accounts/${closed}/archive`)
    await createSchedule(user, {
      ...expenseScheduleBody(checking, housing, { frequency: 'once' }),
      startDate: '2026-11-12',
    })
    await createSchedule(user, {
      kind: 'transfer',
      label: 'Versement Livret',
      amountCents: 10_000,
      triggerMode: 'manual',
      reminderDaysBefore: 10,
      note: null,
      active: true,
      frequency: 'once',
      interval: 1,
      startDate: '2026-11-20',
      anchorLastDay: false,
      endDate: null,
      maxOccurrences: null,
      businessDayRule: 'exact',
      sourceAccountId: savings,
      targetAccountId: checking,
    })

    const summary = dashboardSummarySchema.parse(
      (await user.get('/dashboard/summary')).body,
    )

    expect(summary.manualPaymentsCount).toBe(3)
    expect(summary.nextManualPayment).toEqual({
      accountId: checking,
      date: '2026-11-11',
    })
  })
})
