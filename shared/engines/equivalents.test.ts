import { describe, expect, it } from 'vitest'
import {
  equivalentTotals,
  monthlyEquivalentCents,
  periodicAmount,
} from './equivalents.js'
import { recurrence, schedule } from '../tests/engine-fixtures.js'

describe('monthlyEquivalentCents (ECH-05)', () => {
  it('gives 3.68 EUR for 44.16 EUR per year', () => {
    expect(
      monthlyEquivalentCents({
        amountCents: 4_416,
        frequency: 'yearly',
        interval: 1,
      }),
    ).toBe(368)
  })

  it('gives 5.00 EUR for 120 EUR every 2 years', () => {
    expect(
      monthlyEquivalentCents({
        amountCents: 12_000,
        frequency: 'yearly',
        interval: 2,
      }),
    ).toBe(500)
  })

  it('uses 52 weeks per year for weekly amounts, rounded to the cent', () => {
    expect(
      monthlyEquivalentCents({
        amountCents: 1_000,
        frequency: 'weekly',
        interval: 1,
      }),
    ).toBe(4_333)
    expect(
      monthlyEquivalentCents({
        amountCents: 1_000,
        frequency: 'weekly',
        interval: 2,
      }),
    ).toBe(2_167)
  })

  it('divides monthly amounts by the interval, halves up', () => {
    expect(
      monthlyEquivalentCents({
        amountCents: 101,
        frequency: 'monthly',
        interval: 2,
      }),
    ).toBe(51)
  })

  it('does not count a one-off schedule', () => {
    expect(
      monthlyEquivalentCents({
        amountCents: 50_000,
        frequency: 'once',
        interval: 1,
      }),
    ).toBeNull()
  })

  it('reads the periodic amount of a schedule', () => {
    expect(
      periodicAmount(
        schedule({
          amountCents: 4_416,
          recurrence: recurrence({ frequency: 'yearly', interval: 3 }),
        }),
      ),
    ).toEqual({ amountCents: 4_416, frequency: 'yearly', interval: 3 })
  })
})

describe('equivalentTotals (ECH-09, ECH-10)', () => {
  it('sums rounded monthly equivalents and rounds the exact annual total once', () => {
    expect(
      equivalentTotals([
        { amountCents: 1_000, frequency: 'weekly', interval: 1 },
        { amountCents: 4_416, frequency: 'yearly', interval: 1 },
        { amountCents: 2_000, frequency: 'monthly', interval: 3 },
        { amountCents: 70_000, frequency: 'once', interval: 1 },
      ]),
    ).toEqual({
      monthlyCents: 4_333 + 368 + 667,
      annualCents: 52_000 + 4_416 + 8_000,
    })
  })

  it('returns zero totals without schedule', () => {
    expect(equivalentTotals([])).toEqual({ monthlyCents: 0, annualCents: 0 })
  })
})
