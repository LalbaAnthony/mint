import { describe, expect, it } from 'vitest'
import {
  account,
  envelope,
  expensePosting,
  forecastInput,
  operation,
  recurrence,
  schedule,
  today,
  transferPosting,
} from '../tests/engine-fixtures.js'
import type { AccountForecast, Forecast } from '../types/forecast.js'
import {
  computeForecast,
  forecastEndDate,
  forecastIndicators,
} from './forecast.js'

function onlyAccount(forecast: Forecast): AccountForecast {
  const [first] = forecast.accounts
  if (first === undefined) {
    throw new Error('No account forecast')
  }
  return first
}

function balanceOn(
  forecast: AccountForecast,
  date: string,
): number | undefined {
  return forecast.days.find((day) => day.date === date)?.balanceCents
}

describe('forecastEndDate (PRV-06)', () => {
  it('adds the horizon in months, clamped to the end of the month, inclusive', () => {
    expect(forecastEndDate('2026-11-11', 3)).toBe('2027-02-11')
    expect(forecastEndDate('2027-01-31', 1)).toBe('2027-02-28')
    expect(forecastEndDate('2026-11-11', 12)).toBe('2027-11-11')
  })

  it('rejects a horizon below one month', () => {
    expect(() => forecastEndDate(today, 0)).toThrow(RangeError)
    expect(() => forecastEndDate(today, 1.5)).toThrow(RangeError)
  })
})

describe('computeForecast (PRV-01 to PRV-03)', () => {
  it('produces one end-of-day balance per day from today to the end of the horizon', () => {
    const forecast = computeForecast(
      forecastInput({ today: '2027-01-31', horizonMonths: 1 }),
    )

    expect(forecast.startDate).toBe('2027-01-31')
    expect(forecast.endDate).toBe('2027-02-28')
    expect(onlyAccount(forecast).days).toHaveLength(29)
  })

  it('starts from the calculated balance including today, minus the envelope share of today', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          accounts: [account({ initialBalanceCents: 100_000 })],
          operations: [
            operation({ id: 'past', date: '2026-11-02', amountCents: -2_000 }),
            operation({ id: 'today', date: today, amountCents: -3_000 }),
          ],
          envelopes: [envelope({ monthlyAmountCents: 20_000 })],
        }),
      ),
    )

    expect(forecast.days[0]).toEqual({
      date: today,
      balanceCents: 100_000 - 2_000 - 3_000 - 1_000,
      flows: [
        {
          source: 'envelope',
          envelopeId: 'envelope',
          label: 'Courses',
          amountCents: -1_000,
        },
      ],
    })
  })

  it('projects due occurrences that the worker has not executed yet on today', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          accounts: [account({ initialBalanceCents: 50_000 })],
          schedules: [
            schedule({
              createdOn: '2026-11-01',
              recurrence: recurrence({ startDate: '2026-11-05' }),
            }),
          ],
        }),
      ),
    )

    expect(forecast.days[0]?.flows).toEqual([
      {
        source: 'occurrence',
        scheduleId: 'schedule',
        kind: 'expense',
        label: 'Planned',
        originalDate: '2026-11-05',
        effectiveDate: '2026-11-05',
        amountCents: -10_000,
        triggerMode: 'auto',
        isSubscription: false,
      },
    ])
    expect(forecast.days[0]?.balanceCents).toBe(40_000)
  })

  it('does not project due occurrences dated before the initial balance of the account', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          accounts: [account({ initialBalanceDate: '2026-11-08' })],
          schedules: [
            schedule({
              createdOn: '2026-11-01',
              recurrence: recurrence({ startDate: '2026-11-05' }),
            }),
          ],
        }),
      ),
    )

    expect(forecast.days[0]?.flows).toEqual([])
  })

  it('ignores occurrences dated before the creation of the schedule, executed or skipped ones', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          horizonMonths: 1,
          schedules: [
            schedule({
              id: 'reentered',
              createdOn: today,
              recurrence: recurrence({ startDate: '2026-01-05' }),
            }),
            schedule({
              id: 'done',
              createdOn: '2026-11-01',
              recurrence: recurrence({ startDate: '2026-11-05' }),
              exceptions: [
                {
                  originalDate: '2026-11-05',
                  state: 'executed',
                  effectiveDate: '2026-11-05',
                  amountCents: 10_000,
                },
                {
                  originalDate: '2026-12-05',
                  state: 'skipped',
                  effectiveDate: null,
                  amountCents: null,
                },
              ],
            }),
          ],
        }),
      ),
    )

    expect(
      forecast.days.flatMap((day) =>
        day.flows.map((flow) => [
          day.date,
          flow.source === 'occurrence' && flow.scheduleId,
        ]),
      ),
    ).toEqual([['2026-12-05', 'reentered']])
  })

  it('adds operations already recorded after today, on active accounts only', () => {
    const forecast = computeForecast(
      forecastInput({
        accounts: [account(), account({ id: 'closed', archived: true })],
        operations: [
          operation({ id: 'future', date: '2026-11-20', amountCents: -4_000 }),
          operation({
            id: 'closed-future',
            accountId: 'closed',
            date: '2026-11-20',
            amountCents: -4_000,
          }),
          operation({ id: 'beyond', date: '2027-03-01', amountCents: -4_000 }),
        ],
      }),
    )

    expect(forecast.accounts.map((item) => item.accountId)).toEqual(['current'])
    expect(
      onlyAccount(forecast).days.find((day) => day.date === '2026-11-20')
        ?.flows,
    ).toEqual([
      { source: 'operation', operationId: 'future', amountCents: -4_000 },
    ])
    expect(onlyAccount(forecast).days.at(-1)?.balanceCents).toBe(-4_000)
  })

  it('projects neither transfers nor envelopes touching an archived account (CPT-07)', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          accounts: [account(), account({ id: 'closed', archived: true })],
          schedules: [
            schedule({
              createdOn: today,
              posting: transferPosting('current', 'closed'),
            }),
            schedule({
              id: 'card',
              createdOn: today,
              posting: expensePosting({ accountId: 'closed' }),
            }),
          ],
          envelopes: [envelope({ accountId: 'closed' })],
        }),
      ),
    )

    expect(forecast.days.flatMap((day) => day.flows)).toEqual([])
  })

  it('carries the trigger mode and the subscription marker of each occurrence (CAL-02)', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          schedules: [
            schedule({
              createdOn: today,
              triggerMode: 'manual',
              isSubscription: true,
            }),
          ],
        }),
      ),
    )
    const flow = forecast.days.find((day) => day.date === '2026-12-05')
      ?.flows[0]

    expect(flow).toEqual(
      expect.objectContaining({ triggerMode: 'manual', isSubscription: true }),
    )
  })

  it('subtracts the occurrences falling in the envelope categories from the smoothing', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          horizonMonths: 1,
          envelopes: [envelope({ monthlyAmountCents: 30_000 })],
          schedules: [
            schedule({
              createdOn: today,
              amountCents: 10_000,
              recurrence: recurrence({ startDate: '2026-11-20' }),
              posting: expensePosting({ categoryId: 'drive' }),
            }),
          ],
        }),
      ),
    )
    const envelopeTotal = forecast.days
      .filter((day) => day.date <= '2026-11-30')
      .flatMap((day) => day.flows)
      .filter((flow) => flow.source === 'envelope')
      .reduce((total, flow) => total + flow.amountCents, 0)

    expect(envelopeTotal).toBe(-20_000)
  })

  it('rejects an account whose initial balance is dated after today', () => {
    expect(() =>
      computeForecast(
        forecastInput({
          accounts: [account({ initialBalanceDate: '2026-11-12' })],
        }),
      ),
    ).toThrow(RangeError)
  })
})

describe('indicators (PRV-07)', () => {
  it('reports the minimum and its first date, the first day below the threshold and the first negative day', () => {
    expect(
      forecastIndicators(
        [
          { date: '2026-11-11', balanceCents: 30_000 },
          { date: '2026-11-12', balanceCents: 20_000 },
          { date: '2026-11-13', balanceCents: -500 },
          { date: '2026-11-14', balanceCents: -500 },
        ],
        20_000,
      ),
    ).toEqual({
      minBalanceCents: -500,
      minBalanceDate: '2026-11-13',
      firstBelowThresholdDate: '2026-11-13',
      firstNegativeDate: '2026-11-13',
    })
  })

  it('reports nothing below a missing threshold or above zero', () => {
    expect(
      forecastIndicators([{ date: '2026-11-11', balanceCents: 0 }], null),
    ).toEqual({
      minBalanceCents: 0,
      minBalanceDate: '2026-11-11',
      firstBelowThresholdDate: null,
      firstNegativeDate: null,
    })
  })

  it('needs at least one day', () => {
    expect(() => forecastIndicators([], null)).toThrow(RangeError)
  })

  it('computes the indicators of each account from its threshold', () => {
    const forecast = onlyAccount(
      computeForecast(
        forecastInput({
          accounts: [
            account({
              initialBalanceCents: 30_000,
              lowBalanceThresholdCents: 25_000,
            }),
          ],
          schedules: [
            schedule({
              createdOn: today,
              recurrence: recurrence({
                frequency: 'once',
                startDate: '2026-11-20',
              }),
            }),
          ],
        }),
      ),
    )

    expect(forecast.indicators).toEqual({
      minBalanceCents: 20_000,
      minBalanceDate: '2026-11-20',
      firstBelowThresholdDate: '2026-11-20',
      firstNegativeDate: null,
    })
    expect(balanceOn(forecast, '2026-11-19')).toBe(30_000)
  })
})

describe('aggregate view (PRV-05)', () => {
  it('sums the active accounts with subtotals by usage', () => {
    const forecast = computeForecast(
      forecastInput({
        horizonMonths: 1,
        accounts: [
          account({
            id: 'current',
            usage: 'current',
            initialBalanceCents: 200_000,
          }),
          account({
            id: 'lep',
            usage: 'emergency',
            initialBalanceCents: 500_000,
          }),
          account({
            id: 'livret-a',
            usage: 'savings',
            initialBalanceCents: 1_200_000,
          }),
          account({
            id: 'pea',
            usage: 'investment',
            initialBalanceCents: 300_000,
          }),
          account({
            id: 'closed',
            initialBalanceCents: 999_999,
            archived: true,
          }),
        ],
      }),
    )

    expect(forecast.aggregate.days[0]).toEqual({
      date: today,
      totalCents: 2_200_000,
      usageSubtotals: {
        current: 200_000,
        emergency: 500_000,
        savings: 1_200_000,
        investment: 300_000,
      },
    })
    expect(forecast.aggregate.indicators).toEqual({
      minBalanceCents: 2_200_000,
      minBalanceDate: today,
      firstBelowThresholdDate: null,
      firstNegativeDate: null,
    })
  })
})
