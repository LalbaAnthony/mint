import { describe, expect, it } from 'vitest'
import {
  account,
  forecastInput,
  operation,
  recurrence,
  schedule,
  today,
} from '../tests/engine-fixtures.js'
import type { InterestSettings } from '../types/interest.js'
import { computeForecast } from './forecast.js'
import {
  accruedInterestCents,
  acquiredInterestCents,
  balanceExcludingInterest,
  capitalizationInterestCents,
  currentRatePct,
  interestPeriodStart,
  nextCapitalization,
  previousCapitalization,
  realInterestDays,
  upcomingCapitalization,
} from './interest.js'

function settings(overrides: Partial<InterestSettings> = {}): InterestSettings {
  return {
    method: 'fortnight',
    capitalization: 'dec31',
    anniversaryDate: null,
    rates: [{ effectiveDate: '2025-08-01', annualRatePct: 2.4 }],
    ...overrides,
  }
}

function livret(interest: InterestSettings) {
  return account({
    id: 'livret',
    usage: 'savings',
    initialBalanceCents: 1_000_000,
    initialBalanceDate: '2026-01-01',
    interest,
  })
}

describe('capitalization dates (LIV-03)', () => {
  it('capitalizes on 31 December', () => {
    const dec31 = settings()
    expect(nextCapitalization(dec31, '2026-11-11')).toBe('2026-12-31')
    expect(nextCapitalization(dec31, '2026-12-31')).toBe('2026-12-31')
    expect(previousCapitalization(dec31, '2026-12-31')).toBe('2025-12-31')
    expect(previousCapitalization(dec31, '2027-01-01')).toBe('2026-12-31')
  })

  it('capitalizes on the anniversary, 29 February giving 28 February', () => {
    const anniversary = settings({
      capitalization: 'anniversary',
      anniversaryDate: '2024-02-29',
    })
    expect(nextCapitalization(anniversary, '2026-11-11')).toBe('2027-02-28')
    expect(nextCapitalization(anniversary, '2028-01-01')).toBe('2028-02-29')
    expect(previousCapitalization(anniversary, '2027-02-28')).toBe('2026-02-28')
  })

  it('reads the rate in force at a date', () => {
    const changing = settings({
      rates: [
        { effectiveDate: '2026-08-01', annualRatePct: 1.7 },
        { effectiveDate: '2025-08-01', annualRatePct: 2.4 },
      ],
    })
    expect(currentRatePct(changing, '2025-07-31')).toBeNull()
    expect(currentRatePct(changing, '2026-07-31')).toBe(2.4)
    expect(currentRatePct(changing, '2026-08-01')).toBe(1.7)
  })
})

describe('fortnight method (LIV-03)', () => {
  it('earns a deposit from the next fortnight and loses a withdrawal from the start of its fortnight', () => {
    const operations = [
      operation({
        id: 'deposit',
        accountId: 'livret',
        date: '2026-03-10',
        amountCents: 240_000,
      }),
      operation({
        id: 'withdrawal',
        accountId: 'livret',
        date: '2026-06-20',
        amountCents: -100_000,
      }),
    ]

    expect(
      capitalizationInterestCents(
        livret(settings()),
        operations,
        '2026-12-31',
        'interest',
      ),
    ).toBe(24_000 + 19 * 240 - 13 * 100)
  })

  it('applies a rate change from the fortnight it starts and rounds once at capitalization', () => {
    const changing = settings({
      rates: [
        { effectiveDate: '2025-08-01', annualRatePct: 2.4 },
        { effectiveDate: '2026-08-01', annualRatePct: 1.7 },
      ],
    })

    expect(
      capitalizationInterestCents(livret(changing), [], '2026-12-31', null),
    ).toBe(21_083)
  })

  it('starts a new period once the capitalization day is reached', () => {
    expect(upcomingCapitalization(settings(), '2026-12-30')).toBe('2026-12-31')
    expect(upcomingCapitalization(settings(), '2026-12-31')).toBe('2027-12-31')
    expect(
      acquiredInterestCents(livret(settings()), [], '2026-12-31', null),
    ).toBe(0)
  })

  it('counts only the fortnights completed so far as acquired', () => {
    expect(
      acquiredInterestCents(livret(settings()), [], '2026-11-11', null),
    ).toBe(20 * 1_000)
    expect(
      interestPeriodStart(livret(settings()), settings(), '2026-11-11'),
    ).toBe('2026-01-01')
  })

  it('earns nothing without a rate', () => {
    expect(
      capitalizationInterestCents(
        livret(settings({ rates: [] })),
        [],
        '2026-12-31',
        null,
      ),
    ).toBe(0)
  })
})

describe('daily method (LIV-03)', () => {
  const daily = settings({
    method: 'daily',
    rates: [{ effectiveDate: '2026-01-01', annualRatePct: 2 }],
  })

  it('accrues the end-of-day balance over 365 days, the capitalized interest of the last day excluded', () => {
    const operations = [
      operation({
        id: 'deposit',
        accountId: 'livret',
        date: '2026-07-02',
        amountCents: 365_000,
      }),
      operation({
        id: 'previous-interest',
        accountId: 'livret',
        date: '2026-12-31',
        amountCents: 999,
        categoryId: 'interest',
      }),
    ]

    expect(
      capitalizationInterestCents(
        livret(daily),
        operations,
        '2026-12-31',
        'interest',
      ),
    ).toBe(20_000 + 3_660)
  })

  it('counts the days up to today as acquired', () => {
    expect(acquiredInterestCents(livret(daily), [], '2026-07-01', null)).toBe(
      9_973,
    )
  })
})

describe('interest in the forecast (PRV-03, LIV-05)', () => {
  it('credits the estimated interest on the capitalization day of the system schedule', () => {
    const forecast = computeForecast(
      forecastInput({
        accounts: [livret(settings())],
        schedules: [
          schedule({
            id: 'interest-schedule',
            label: 'Intérêts',
            amountCents: 0,
            system: true,
            recurrence: recurrence({
              frequency: 'yearly',
              startDate: '2026-12-31',
            }),
            posting: {
              kind: 'income',
              accountId: 'livret',
              paymentMethodId: null,
              categoryId: 'interest',
            },
          }),
        ],
      }),
    )

    const days = forecast.accounts[0]?.days ?? []
    const capitalization = days.find((day) => day.date === '2026-12-31')
    expect(capitalization?.flows).toEqual([
      expect.objectContaining({
        scheduleId: 'interest-schedule',
        amountCents: 24_000,
        occurrenceAmountCents: 24_000,
        system: true,
      }),
    ])
    expect(capitalization?.balanceCents).toBe(1_024_000)
  })
})

describe('interest edge cases (LIV-03)', () => {
  it('skips the fortnight already started at the initial balance date and the empty ones', () => {
    const lateStart = account({
      id: 'livret',
      initialBalanceCents: 1_000_000,
      initialBalanceDate: '2026-01-05',
      interest: settings(),
    })
    const emptied = [
      operation({
        id: 'emptied',
        accountId: 'livret',
        date: '2026-12-10',
        amountCents: -1_000_000,
      }),
      operation({
        id: 'elsewhere',
        accountId: 'current',
        date: '2026-03-10',
        amountCents: 50_000,
      }),
    ]

    expect(
      capitalizationInterestCents(lateStart, emptied, '2026-12-31', null),
    ).toBe(21 * 1_000)
  })

  it('accrues daily interest only from the initial balance date and nothing on the capitalization day itself', () => {
    const daily = settings({
      method: 'daily',
      rates: [{ effectiveDate: '2026-01-01', annualRatePct: 2 }],
    })
    const lateStart = account({
      id: 'livret',
      initialBalanceCents: 365_000,
      initialBalanceDate: '2026-07-02',
      interest: daily,
    })

    expect(capitalizationInterestCents(lateStart, [], '2026-12-31', null)).toBe(
      3_660,
    )
    expect(acquiredInterestCents(lateStart, [], '2026-12-31', null)).toBe(0)
  })

  it('estimates nothing for an account without interest settings', () => {
    const plain = account({ id: 'livret', initialBalanceCents: 1_000_000 })

    expect(capitalizationInterestCents(plain, [], '2026-12-31', null)).toBe(0)
    expect(acquiredInterestCents(plain, [], '2026-11-11', null)).toBe(0)
    expect(
      accruedInterestCents(
        plain,
        new Map(),
        '2025-12-31',
        '2026-12-31',
        '2026-12-31',
      ),
    ).toBe(0)
  })

  it('reads no day before the initial balance date', () => {
    expect(
      realInterestDays(livret(settings()), [], '2025-01-01', '2025-12-31', null)
        .size,
    ).toBe(0)
  })

  it('subtracts the declared and the credited interest from the balance', () => {
    const declared = account({
      id: 'livret',
      initialBalanceCents: 1_000_000,
      capitalizedInterestCents: 20_000,
    })
    const credited = [
      operation({
        id: 'interest',
        accountId: 'livret',
        date: '2026-11-05',
        amountCents: 5_000,
        categoryId: 'interest',
      }),
    ]

    expect(
      balanceExcludingInterest(
        declared,
        credited,
        1_005_000,
        today,
        'interest',
      ),
    ).toBe(980_000)
    expect(
      balanceExcludingInterest(declared, credited, 1_005_000, today, null),
    ).toBe(985_000)
  })
})
