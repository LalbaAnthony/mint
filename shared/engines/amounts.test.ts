import { describe, expect, it } from 'vitest'
import {
  divideRoundHalfUp,
  spreadEvenly,
  sumFractionsRoundHalfUp,
} from './amounts.js'

describe('divideRoundHalfUp', () => {
  it('rounds to the nearest integer, halves up', () => {
    expect(divideRoundHalfUp(4_416, 12)).toBe(368)
    expect(divideRoundHalfUp(52_000, 12)).toBe(4_333)
    expect(divideRoundHalfUp(5, 2)).toBe(3)
    expect(divideRoundHalfUp(5, 3)).toBe(2)
    expect(divideRoundHalfUp(4, 3)).toBe(1)
    expect(divideRoundHalfUp(0, 7)).toBe(0)
  })

  it('rejects negative, zero or non-integer operands', () => {
    expect(() => divideRoundHalfUp(-1, 2)).toThrow(RangeError)
    expect(() => divideRoundHalfUp(1, 0)).toThrow(RangeError)
    expect(() => divideRoundHalfUp(1.5, 2)).toThrow(RangeError)
    expect(() => divideRoundHalfUp(1, Number.NaN)).toThrow(RangeError)
  })
})

describe('spreadEvenly (PRV-04)', () => {
  it('floors each share and carries the rounding remainder on the last one', () => {
    const shares = spreadEvenly(30_000, 31)

    expect(shares.slice(0, 30)).toEqual(Array.from({ length: 30 }, () => 967))
    expect(shares[30]).toBe(990)
    expect(shares.reduce((total, share) => total + share, 0)).toBe(30_000)
  })

  it('splits exact totals evenly', () => {
    expect(spreadEvenly(18_000, 20)).toEqual(
      Array.from({ length: 20 }, () => 900),
    )
    expect(spreadEvenly(5, 3)).toEqual([1, 1, 3])
    expect(spreadEvenly(0, 2)).toEqual([0, 0])
  })

  it('rejects a negative total or no part', () => {
    expect(() => spreadEvenly(-1, 2)).toThrow(RangeError)
    expect(() => spreadEvenly(10, 0)).toThrow(RangeError)
  })
})

describe('sumFractionsRoundHalfUp', () => {
  it('sums exact fractions and rounds once', () => {
    expect(sumFractionsRoundHalfUp([])).toBe(0)
    expect(sumFractionsRoundHalfUp([{ numerator: 1, denominator: 2 }])).toBe(1)
    expect(
      sumFractionsRoundHalfUp([
        { numerator: 52_000, denominator: 3 },
        { numerator: 100, denominator: 7 },
        { numerator: 12_000, denominator: 3 },
      ]),
    ).toBe(21_348)
  })

  it('rejects negative fractions', () => {
    expect(() =>
      sumFractionsRoundHalfUp([{ numerator: -1, denominator: 2 }]),
    ).toThrow(RangeError)
    expect(() =>
      sumFractionsRoundHalfUp([{ numerator: 1, denominator: 0 }]),
    ).toThrow(RangeError)
  })
})
