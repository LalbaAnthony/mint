import type { Fraction } from '../types/amounts.js'
import type {
  EquivalentTotals,
  OccurrenceSource,
  PeriodicAmount,
} from '../types/schedules.js'
import { divideRoundHalfUp, sumFractionsRoundHalfUp } from './amounts.js'

export function periodicAmount(schedule: OccurrenceSource): PeriodicAmount {
  return {
    amountCents: schedule.amountCents,
    frequency: schedule.recurrence.frequency,
    interval: schedule.recurrence.interval,
  }
}

function monthlyFraction(item: PeriodicAmount): Fraction | null {
  switch (item.frequency) {
    case 'once':
      return null
    case 'weekly':
      return {
        numerator: item.amountCents * 52,
        denominator: 12 * item.interval,
      }
    case 'monthly':
      return { numerator: item.amountCents, denominator: item.interval }
    case 'yearly':
      return { numerator: item.amountCents, denominator: 12 * item.interval }
  }
}

function annualFraction(item: PeriodicAmount): Fraction {
  switch (item.frequency) {
    case 'once':
      return { numerator: 0, denominator: 1 }
    case 'weekly':
      return { numerator: item.amountCents * 52, denominator: item.interval }
    case 'monthly':
      return { numerator: item.amountCents * 12, denominator: item.interval }
    case 'yearly':
      return { numerator: item.amountCents, denominator: item.interval }
  }
}

export function monthlyEquivalentCents(item: PeriodicAmount): number | null {
  const fraction = monthlyFraction(item)
  return fraction === null
    ? null
    : divideRoundHalfUp(fraction.numerator, fraction.denominator)
}

export function equivalentTotals(
  items: readonly PeriodicAmount[],
): EquivalentTotals {
  return {
    monthlyCents: items.reduce(
      (total, item) => total + (monthlyEquivalentCents(item) ?? 0),
      0,
    ),
    annualCents: sumFractionsRoundHalfUp(items.map(annualFraction)),
  }
}
