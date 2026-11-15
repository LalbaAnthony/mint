import { describe, expect, it } from 'vitest'
import {
  account,
  categories,
  envelope,
  exception,
  expensePosting,
  forecastInput,
  incomePosting,
  operation,
  recurrence,
  schedule,
  today,
  transferPosting,
} from '../tests/engine-fixtures.js'
import type { AccountForecast, Forecast } from '../types/forecast.js'
import { isoWeekday } from './dates.js'
import { monthlyEquivalentCents, periodicAmount } from './equivalents.js'
import { planExecutions } from './execution.js'
import { computeForecast } from './forecast.js'
import { investmentSummary } from './investments.js'
import { nextPendingOccurrence, occurrencesBetween } from './recurrence.js'
import { monthlyIncomeExpenses, spendingBreakdown } from './reports.js'

function accountForecast(
  forecast: Forecast,
  accountId: string,
): AccountForecast {
  const found = forecast.accounts.find((item) => item.accountId === accountId)
  if (found === undefined) {
    throw new Error(`No forecast for ${accountId}`)
  }
  return found
}

function day(forecast: AccountForecast, date: string) {
  const found = forecast.days.find((item) => item.date === date)
  if (found === undefined) {
    throw new Error(`No forecast day ${date}`)
  }
  return found
}

function signedFlows(forecast: AccountForecast, date: string): number[] {
  return day(forecast, date).flows.map((flow) => flow.amountCents)
}

function envelopeDebits(
  forecast: AccountForecast,
  from: string,
  to: string,
): number[] {
  return forecast.days
    .filter((item) => item.date >= from && item.date <= to)
    .map((item) =>
      item.flows
        .filter((flow) => flow.source === 'envelope')
        .reduce((total, flow) => total + flow.amountCents, 0),
    )
}

describe('US-06 - annual subscription (ECH-04, ECH-05, ECH-09)', () => {
  const subscription = schedule({
    id: 'music',
    label: 'Music',
    amountCents: 4_416,
    isSubscription: true,
    createdOn: today,
    recurrence: recurrence({ frequency: 'yearly', startDate: '2027-01-25' }),
    posting: expensePosting({ paymentMethodId: 'card', categoryId: 'leisure' }),
  })

  it('shows 3.68 EUR per month and a next occurrence on 25 January 2027', () => {
    expect(monthlyEquivalentCents(periodicAmount(subscription))).toBe(368)
    expect(nextPendingOccurrence(subscription, today)).toEqual({
      originalDate: '2027-01-25',
      effectiveDate: '2027-01-25',
      amountCents: 4_416,
      status: 'pending',
      overridden: false,
    })
  })

  it('debits 44.16 EUR on Monday 25 January 2027 and nothing in December 2026', () => {
    const forecast = accountForecast(
      computeForecast(forecastInput({ schedules: [subscription] })),
      'current',
    )
    const occurrenceDays = forecast.days.filter((item) =>
      item.flows.some((flow) => flow.source === 'occurrence'),
    )

    expect(isoWeekday('2027-01-25')).toBe(1)
    expect(occurrenceDays.map((item) => item.date)).toEqual(['2027-01-25'])
    expect(signedFlows(forecast, '2027-01-25')).toEqual([-4_416])
    expect(
      forecast.days.filter(
        (item) => item.date.startsWith('2026-12') && item.flows.length > 0,
      ),
    ).toEqual([])
  })
})

describe('US-07 - rent on the next business day (ECH-06)', () => {
  it('moves 1 January 2027 to Monday 4 January and keeps Monday 1 February', () => {
    const rent = schedule({
      amountCents: 60_000,
      recurrence: recurrence({
        startDate: '2026-12-01',
        businessDayRule: 'next',
      }),
      posting: expensePosting({ categoryId: 'housing' }),
    })

    const occurrences = occurrencesBetween(rent, '2027-01-01', '2027-02-28')

    expect(
      occurrences.map(({ originalDate, effectiveDate }) => ({
        originalDate,
        effectiveDate,
      })),
    ).toEqual([
      { originalDate: '2027-01-01', effectiveDate: '2027-01-04' },
      { originalDate: '2027-02-01', effectiveDate: '2027-02-01' },
    ])
    expect(isoWeekday('2027-01-04')).toBe(1)
    expect(isoWeekday('2027-02-01')).toBe(1)
  })
})

describe('US-08 - variable occurrence (ECH-07)', () => {
  it('credits 180 EUR on 5 January, 200 EUR on 5 February and keeps 200 EUR on the schedule', () => {
    const income = schedule({
      amountCents: 20_000,
      createdOn: today,
      recurrence: recurrence({ startDate: '2026-11-05' }),
      posting: incomePosting(),
      exceptions: [
        exception({ originalDate: '2027-01-05', amountCents: 18_000 }),
      ],
    })

    const forecast = accountForecast(
      computeForecast(forecastInput({ schedules: [income] })),
      'current',
    )

    expect(signedFlows(forecast, '2026-12-05')).toEqual([20_000])
    expect(signedFlows(forecast, '2027-01-05')).toEqual([18_000])
    expect(signedFlows(forecast, '2027-02-05')).toEqual([20_000])
    expect(income.amountCents).toBe(20_000)
  })
})

describe('US-10 - monthly savings transfer (ECH-01, CAT-03, PRV-05)', () => {
  const accounts = [
    account({ id: 'current', usage: 'current', initialBalanceCents: 200_000 }),
    account({
      id: 'livret-a',
      usage: 'savings',
      initialBalanceCents: 1_200_000,
    }),
  ]
  const transfer = schedule({
    id: 'savings',
    amountCents: 10_000,
    createdOn: today,
    recurrence: recurrence({ startDate: '2026-11-06' }),
    posting: transferPosting('current', 'livret-a'),
  })

  it('debits the current account, credits the Livret A and leaves the aggregate unchanged every 6th', () => {
    const forecast = computeForecast(
      forecastInput({ accounts, schedules: [transfer] }),
    )
    const current = accountForecast(forecast, 'current')
    const livret = accountForecast(forecast, 'livret-a')

    for (const date of ['2026-12-06', '2027-01-06', '2027-02-06']) {
      expect(signedFlows(current, date)).toEqual([-10_000])
      expect(signedFlows(livret, date)).toEqual([10_000])
    }
    expect(
      new Set(forecast.aggregate.days.map((item) => item.totalCents)),
    ).toEqual(new Set([1_400_000]))
    expect(day(current, '2027-02-06').balanceCents).toBe(170_000)
    expect(day(livret, '2027-02-06').balanceCents).toBe(1_230_000)
  })

  it('adds 100 EUR to the Save group and nothing to the expenses of the month', () => {
    const executions = planExecutions({
      today: '2026-12-06',
      schedules: [transfer],
      accounts,
    })
    const movements = executions.flatMap((execution) =>
      execution.movements.map((movement, index) =>
        operation({
          id: `movement-${index}`,
          accountId: movement.accountId,
          date: execution.effectiveDate,
          amountCents: movement.amountCents,
          transferGroupId: 'transfer-group',
        }),
      ),
    )
    const groceries = operation({
      id: 'groceries',
      date: '2026-12-02',
      amountCents: -4_500,
      categoryId: 'groceries',
    })

    const breakdown = spendingBreakdown({
      from: '2026-12-01',
      to: '2026-12-31',
      operations: [groceries, ...movements],
      categories,
      accounts,
    })
    const withTransfer = monthlyIncomeExpenses({
      fromMonth: '2026-12-01',
      toMonth: '2026-12-01',
      operations: [groceries, ...movements],
      categories,
    })
    const withoutTransfer = monthlyIncomeExpenses({
      fromMonth: '2026-12-01',
      toMonth: '2026-12-01',
      operations: [groceries],
      categories,
    })

    expect(executions.map((execution) => execution.effectiveDate)).toEqual([
      '2026-12-06',
    ])
    expect(movements).toHaveLength(2)
    expect(breakdown.saveCents).toBe(10_000)
    expect(withTransfer).toEqual(withoutTransfer)
    expect(withTransfer[0]?.expenseCents).toBe(4_500)
  })
})

describe('US-11 - smoothed envelope (ENV-03 to ENV-05, PRV-04)', () => {
  const groceriesEnvelope = envelope({ monthlyAmountCents: 30_000 })
  const novemberSpending = operation({
    id: 'november-groceries',
    date: '2026-11-03',
    amountCents: -12_000,
    categoryId: 'groceries',
  })

  it('debits 9.00 EUR per day from 11 to 30 November', () => {
    const forecast = accountForecast(
      computeForecast(
        forecastInput({
          envelopes: [groceriesEnvelope],
          operations: [novemberSpending],
        }),
      ),
      'current',
    )

    expect(envelopeDebits(forecast, '2026-11-11', '2026-11-30')).toEqual(
      Array.from({ length: 20 }, () => -900),
    )
  })

  it('debits 9.67 EUR per day from 1 to 30 December and 9.90 EUR on the 31st', () => {
    const forecast = accountForecast(
      computeForecast(
        forecastInput({
          envelopes: [groceriesEnvelope],
          operations: [novemberSpending],
        }),
      ),
      'current',
    )

    expect(envelopeDebits(forecast, '2026-12-01', '2026-12-31')).toEqual([
      ...Array.from({ length: 30 }, () => -967),
      -990,
    ])
  })

  it('debits 7.50 EUR per day from 15 to 30 November after a 60 EUR purchase', () => {
    const forecast = accountForecast(
      computeForecast(
        forecastInput({
          today: '2026-11-15',
          envelopes: [groceriesEnvelope],
          operations: [
            novemberSpending,
            operation({
              id: 'purchase',
              date: '2026-11-15',
              amountCents: -6_000,
              categoryId: 'groceries',
            }),
          ],
        }),
      ),
      'current',
    )

    expect(envelopeDebits(forecast, '2026-11-15', '2026-11-30')).toEqual(
      Array.from({ length: 16 }, () => -750),
    )
  })
})

describe('US-12 - balance day by day (CAL-02, PRV-01)', () => {
  it('shows 1 000 EUR on the 19th, -50 EUR and 950 EUR on the 20th, +1 500 EUR and 2 450 EUR on the 28th', () => {
    const forecast = accountForecast(
      computeForecast(
        forecastInput({
          accounts: [
            account({
              initialBalanceCents: 100_000,
              initialBalanceDate: today,
            }),
          ],
          schedules: [
            schedule({
              id: 'expense',
              amountCents: 5_000,
              recurrence: recurrence({
                frequency: 'once',
                startDate: '2026-11-20',
              }),
            }),
            schedule({
              id: 'income',
              amountCents: 150_000,
              recurrence: recurrence({
                frequency: 'once',
                startDate: '2026-11-28',
              }),
              posting: incomePosting(),
            }),
          ],
        }),
      ),
      'current',
    )

    expect(day(forecast, '2026-11-19')).toEqual({
      date: '2026-11-19',
      balanceCents: 100_000,
      flows: [],
    })
    expect(signedFlows(forecast, '2026-11-20')).toEqual([-5_000])
    expect(day(forecast, '2026-11-20').balanceCents).toBe(95_000)
    expect(signedFlows(forecast, '2026-11-28')).toEqual([150_000])
    expect(day(forecast, '2026-11-28').balanceCents).toBe(245_000)
  })
})

describe('US-16 - investment gain (CPT-06)', () => {
  it('shows 2 200 EUR paid in and a latent gain of +330 EUR (+15.0 %)', () => {
    const pea = account({
      id: 'pea',
      usage: 'investment',
      initialBalanceCents: 100_000,
      initialBalanceDate: '2026-11-01',
      valuations: [{ date: '2026-11-30', valueCents: 253_000 }],
    })
    const transfersIn = [
      operation({
        id: 'pea-in-1',
        accountId: 'pea',
        date: '2026-11-06',
        amountCents: 70_000,
        transferGroupId: 'savings-1',
      }),
      operation({
        id: 'pea-in-2',
        accountId: 'pea',
        date: '2026-11-20',
        amountCents: 50_000,
        transferGroupId: 'savings-2',
      }),
    ]

    const summary = investmentSummary(pea, transfersIn, '2026-11-30')

    expect(summary.paidInCents).toBe(220_000)
    expect(summary.latentGainCents).toBe(33_000)
    expect((summary.latentGainCents ?? 0) / summary.paidInCents).toBe(0.15)
  })
})
