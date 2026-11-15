import type { AccountInput } from '../types/accounts.js'
import type {
  InterestBase,
  InterestDay,
  InterestSettings,
} from '../types/interest.js'
import type { OperationInput } from '../types/transactions.js'
import { endOfDayBalances } from './balances.js'
import {
  addDays,
  clampedDate,
  enumerateDays,
  laterDate,
  monthEnd,
  parseIsoDate,
} from './dates.js'

const fortnightDenominator = 24n * 1_000_000n
const dailyDenominator = 365n * 1_000_000n

function capitalizationIn(settings: InterestSettings, year: number): string {
  if (
    settings.capitalization === 'dec31' ||
    settings.anniversaryDate === null
  ) {
    return `${year}-12-31`
  }
  const anniversary = parseIsoDate(settings.anniversaryDate)
  return clampedDate(year, anniversary.month, anniversary.day)
}

export function nextCapitalization(
  settings: InterestSettings,
  date: string,
): string {
  const year = parseIsoDate(date).year
  const sameYear = capitalizationIn(settings, year)
  return sameYear >= date ? sameYear : capitalizationIn(settings, year + 1)
}

export function previousCapitalization(
  settings: InterestSettings,
  date: string,
): string {
  const year = parseIsoDate(date).year
  const sameYear = capitalizationIn(settings, year)
  return sameYear < date ? sameYear : capitalizationIn(settings, year - 1)
}

export function upcomingCapitalization(
  settings: InterestSettings,
  today: string,
): string {
  return nextCapitalization(settings, addDays(today, 1))
}

export function rateUnitsOn(settings: InterestSettings, date: string): bigint {
  let current: number | null = null
  let currentDate = ''
  for (const rate of settings.rates) {
    if (rate.effectiveDate <= date && rate.effectiveDate >= currentDate) {
      current = rate.annualRatePct
      currentDate = rate.effectiveDate
    }
  }
  return current === null ? 0n : BigInt(Math.round(current * 10_000))
}

export function currentRatePct(
  settings: InterestSettings,
  date: string,
): number | null {
  const units = rateUnitsOn(settings, date)
  const hasRate = settings.rates.some((rate) => rate.effectiveDate <= date)
  return hasRate ? Number(units) / 10_000 : null
}

function fortnightStarts(after: string, to: string): string[] {
  const starts: string[] = []
  let cursor = after
  while (cursor < to) {
    const civil = parseIsoDate(cursor)
    const next =
      civil.day < 16
        ? clampedDate(civil.year, civil.month, 16)
        : addDays(monthEnd(cursor), 1)
    if (next > to) {
      break
    }
    starts.push(next)
    cursor = next
  }
  return starts
}

function fortnightEnd(start: string): string {
  const civil = parseIsoDate(start)
  return civil.day === 1
    ? clampedDate(civil.year, civil.month, 15)
    : monthEnd(start)
}

function roundHalfUp(numerator: bigint, denominator: bigint): number {
  return Number((numerator * 2n + denominator) / (denominator * 2n))
}

function startBalance(
  base: InterestBase,
  days: ReadonlyMap<string, InterestDay>,
  date: string,
): number | null {
  const previous = days.get(addDays(date, -1))
  if (previous !== undefined) {
    return previous.balanceCents
  }
  return date === base.initialBalanceDate ? base.initialBalanceCents : null
}

export function accruedInterestCents(
  base: InterestBase,
  days: ReadonlyMap<string, InterestDay>,
  periodStart: string,
  until: string,
  periodEnd: string,
): number {
  const settings = base.interest
  if (settings === null) {
    return 0
  }
  let numerator = 0n
  if (settings.method === 'fortnight') {
    for (const start of fortnightStarts(periodStart, periodEnd)) {
      const end = fortnightEnd(start)
      const lastDay = end < periodEnd ? end : periodEnd
      const opening = startBalance(base, days, start)
      if (lastDay > until || opening === null) {
        continue
      }
      let retained = opening
      for (const date of enumerateDays(start, lastDay)) {
        retained += days.get(date)?.debitsCents ?? 0
      }
      if (retained > 0) {
        numerator += BigInt(retained) * rateUnitsOn(settings, start)
      }
    }
    return roundHalfUp(numerator, fortnightDenominator)
  }
  const last = until < periodEnd ? until : periodEnd
  if (last <= periodStart) {
    return 0
  }
  for (const date of enumerateDays(addDays(periodStart, 1), last)) {
    const day = days.get(date)
    if (day === undefined) {
      continue
    }
    const balance =
      day.balanceCents - (date === periodEnd ? day.interestCreditsCents : 0)
    if (balance > 0) {
      numerator += BigInt(balance) * rateUnitsOn(settings, date)
    }
  }
  return roundHalfUp(numerator, dailyDenominator)
}

export function realInterestDays(
  account: AccountInput,
  operations: readonly OperationInput[],
  from: string,
  to: string,
  interestCategoryId: string | null,
): Map<string, InterestDay> {
  const days = new Map<string, InterestDay>()
  const start = laterDate(from, account.initialBalanceDate)
  if (start > to) {
    return days
  }
  for (const day of endOfDayBalances(account, operations, start, to)) {
    if (day.balanceCents !== null) {
      days.set(day.date, {
        balanceCents: day.balanceCents,
        debitsCents: 0,
        interestCreditsCents: 0,
      })
    }
  }
  for (const operation of operations) {
    const day = days.get(operation.date)
    if (operation.accountId !== account.id || day === undefined) {
      continue
    }
    if (operation.amountCents < 0) {
      day.debitsCents += operation.amountCents
    } else if (
      interestCategoryId !== null &&
      operation.categoryId === interestCategoryId
    ) {
      day.interestCreditsCents += operation.amountCents
    }
  }
  return days
}

export function capitalizationInterestCents(
  account: AccountInput,
  operations: readonly OperationInput[],
  capitalizationDate: string,
  interestCategoryId: string | null,
): number {
  const settings = account.interest
  if (settings === null) {
    return 0
  }
  const periodStart = previousCapitalization(settings, capitalizationDate)
  return accruedInterestCents(
    account,
    realInterestDays(
      account,
      operations,
      periodStart,
      capitalizationDate,
      interestCategoryId,
    ),
    periodStart,
    capitalizationDate,
    capitalizationDate,
  )
}

export function acquiredInterestCents(
  account: AccountInput,
  operations: readonly OperationInput[],
  today: string,
  interestCategoryId: string | null,
): number {
  const settings = account.interest
  if (settings === null) {
    return 0
  }
  const next = upcomingCapitalization(settings, today)
  const periodStart = previousCapitalization(settings, next)
  return accruedInterestCents(
    account,
    realInterestDays(
      account,
      operations,
      periodStart,
      today,
      interestCategoryId,
    ),
    periodStart,
    today,
    next,
  )
}

export function interestPeriodStart(
  account: AccountInput,
  settings: InterestSettings,
  today: string,
): string {
  const start = addDays(
    previousCapitalization(settings, upcomingCapitalization(settings, today)),
    1,
  )
  return laterDate(start, account.initialBalanceDate)
}

export function balanceExcludingInterest(
  account: AccountInput,
  operations: readonly OperationInput[],
  balanceCents: number,
  date: string,
  interestCategoryId: string | null,
): number {
  const interest = operations
    .filter(
      (operation) =>
        operation.accountId === account.id &&
        interestCategoryId !== null &&
        operation.categoryId === interestCategoryId &&
        operation.date >= account.initialBalanceDate &&
        operation.date <= date,
    )
    .reduce((total, operation) => total + operation.amountCents, 0)
  return balanceCents - account.capitalizedInterestCents - interest
}
