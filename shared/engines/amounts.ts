import type { Fraction } from '../types/amounts.js'

function assertSafeInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${name} must be a safe integer, got ${value}`)
  }
}

export function divideRoundHalfUp(
  numerator: number,
  denominator: number,
): number {
  assertSafeInteger(numerator, 'numerator')
  assertSafeInteger(denominator, 'denominator')
  if (numerator < 0 || denominator <= 0) {
    throw new RangeError(
      'divideRoundHalfUp expects numerator >= 0 and denominator > 0',
    )
  }
  const remainder = numerator % denominator
  const quotient = (numerator - remainder) / denominator
  return remainder * 2 >= denominator ? quotient + 1 : quotient
}

export function spreadEvenly(totalCents: number, parts: number): number[] {
  assertSafeInteger(totalCents, 'totalCents')
  assertSafeInteger(parts, 'parts')
  if (totalCents < 0 || parts <= 0) {
    throw new RangeError('spreadEvenly expects totalCents >= 0 and parts > 0')
  }
  const share = Math.floor(totalCents / parts)
  const shares = Array.from({ length: parts }, () => share)
  shares[parts - 1] = totalCents - share * (parts - 1)
  return shares
}

function greatestCommonDivisor(first: bigint, second: bigint): bigint {
  let a = first
  let b = second
  while (b !== 0n) {
    ;[a, b] = [b, a % b]
  }
  return a
}

export function sumFractionsRoundHalfUp(
  fractions: readonly Fraction[],
): number {
  let numerator = 0n
  let denominator = 1n
  for (const fraction of fractions) {
    assertSafeInteger(fraction.numerator, 'numerator')
    assertSafeInteger(fraction.denominator, 'denominator')
    if (fraction.numerator < 0 || fraction.denominator <= 0) {
      throw new RangeError('fractions must be >= 0 with a positive denominator')
    }
    const fractionDenominator = BigInt(fraction.denominator)
    const common =
      (denominator / greatestCommonDivisor(denominator, fractionDenominator)) *
      fractionDenominator
    numerator =
      numerator * (common / denominator) +
      BigInt(fraction.numerator) * (common / fractionDenominator)
    denominator = common
  }
  return Number((numerator * 2n + denominator) / (denominator * 2n))
}
