import type {
  Occurrence,
  OccurrenceException,
  OccurrenceSource,
  Recurrence,
} from '../types/schedules.js'
import { applyBusinessDayRule } from './business-days.js'
import {
  addDays,
  clampedDate,
  daysBetween,
  daysInMonth,
  isWithin,
  parseIsoDate,
  shiftMonth,
} from './dates.js'
import { compareCodeUnits } from './ordering.js'

export const businessDayShiftMargin = 7

function assertValidRecurrence(recurrence: Recurrence): void {
  if (!Number.isInteger(recurrence.interval) || recurrence.interval < 1) {
    throw new RangeError('Recurrence interval must be an integer >= 1')
  }
  if (
    recurrence.maxOccurrences !== null &&
    (!Number.isInteger(recurrence.maxOccurrences) ||
      recurrence.maxOccurrences < 1)
  ) {
    throw new RangeError('Recurrence maxOccurrences must be an integer >= 1')
  }
}

function anchoredDate(
  recurrence: Recurrence,
  year: number,
  month: number,
): string {
  if (recurrence.anchorLastDay) {
    return clampedDate(year, month, daysInMonth(year, month))
  }
  return clampedDate(year, month, parseIsoDate(recurrence.startDate).day)
}

export function originalDateAt(recurrence: Recurrence, index: number): string {
  const start = parseIsoDate(recurrence.startDate)
  switch (recurrence.frequency) {
    case 'once':
      return recurrence.startDate
    case 'weekly':
      return addDays(recurrence.startDate, 7 * recurrence.interval * index)
    case 'monthly': {
      const target = shiftMonth(
        start.year,
        start.month,
        recurrence.interval * index,
      )
      return anchoredDate(recurrence, target.year, target.month)
    }
    case 'yearly':
      return anchoredDate(
        recurrence,
        start.year + recurrence.interval * index,
        start.month,
      )
  }
}

function estimatedIndexFor(recurrence: Recurrence, date: string): number {
  const start = parseIsoDate(recurrence.startDate)
  const target = parseIsoDate(date)
  switch (recurrence.frequency) {
    case 'once':
      return 0
    case 'weekly':
      return Math.ceil(
        daysBetween(recurrence.startDate, date) / (7 * recurrence.interval),
      )
    case 'monthly':
      return Math.floor(
        ((target.year - start.year) * 12 + (target.month - start.month)) /
          recurrence.interval,
      )
    case 'yearly':
      return Math.floor((target.year - start.year) / recurrence.interval)
  }
}

function occurrenceLimit(recurrence: Recurrence): number {
  if (recurrence.frequency === 'once') {
    return 1
  }
  return recurrence.maxOccurrences ?? Number.POSITIVE_INFINITY
}

function firstIndexOnOrAfter(
  recurrence: Recurrence,
  date: string,
  limit: number,
): number {
  let index = Math.max(0, estimatedIndexFor(recurrence, date))
  while (index < limit && originalDateAt(recurrence, index) < date) {
    index += 1
  }
  return index
}

export function* originalDates(
  recurrence: Recurrence,
  from: string,
): Generator<string> {
  assertValidRecurrence(recurrence)
  const limit = occurrenceLimit(recurrence)
  for (
    let index = firstIndexOnOrAfter(recurrence, from, limit);
    index < limit;
    index += 1
  ) {
    const date = originalDateAt(recurrence, index)
    if (recurrence.endDate !== null && date > recurrence.endDate) {
      return
    }
    yield date
  }
}

export function originalDatesBetween(
  recurrence: Recurrence,
  from: string,
  to: string,
): string[] {
  const dates: string[] = []
  for (const date of originalDates(recurrence, from)) {
    if (date > to) {
      break
    }
    dates.push(date)
  }
  return dates
}

export function isOriginalDate(recurrence: Recurrence, date: string): boolean {
  return originalDatesBetween(recurrence, date, date).length === 1
}

export function resolveOccurrence(
  source: OccurrenceSource,
  originalDate: string,
  exception: OccurrenceException | undefined,
): Occurrence {
  const computedEffectiveDate = applyBusinessDayRule(
    originalDate,
    source.recurrence.businessDayRule,
  )
  if (exception === undefined) {
    return {
      originalDate,
      effectiveDate: computedEffectiveDate,
      amountCents: source.amountCents,
      status: 'pending',
      overridden: false,
    }
  }
  return {
    originalDate,
    effectiveDate: exception.effectiveDate ?? computedEffectiveDate,
    amountCents: exception.amountCents ?? source.amountCents,
    status: exception.state === 'overridden' ? 'pending' : exception.state,
    overridden: exception.state === 'overridden',
  }
}

function exceptionsByOriginalDate(
  exceptions: readonly OccurrenceException[],
): Map<string, OccurrenceException> {
  return new Map(
    exceptions.map((exception) => [exception.originalDate, exception]),
  )
}

export function compareOccurrences(
  first: Occurrence,
  second: Occurrence,
): number {
  return (
    compareCodeUnits(first.effectiveDate, second.effectiveDate) ||
    compareCodeUnits(first.originalDate, second.originalDate)
  )
}

export function occurrencesBetween(
  source: OccurrenceSource,
  from: string,
  to: string,
): Occurrence[] {
  if (from > to) {
    return []
  }
  const exceptions = exceptionsByOriginalDate(source.exceptions)
  const originals = new Set(
    originalDatesBetween(
      source.recurrence,
      addDays(from, -businessDayShiftMargin),
      addDays(to, businessDayShiftMargin),
    ),
  )
  for (const exception of source.exceptions) {
    if (
      exception.effectiveDate !== null &&
      isWithin(exception.effectiveDate, from, to) &&
      isOriginalDate(source.recurrence, exception.originalDate)
    ) {
      originals.add(exception.originalDate)
    }
  }
  return [...originals]
    .map((originalDate) =>
      resolveOccurrence(source, originalDate, exceptions.get(originalDate)),
    )
    .filter((occurrence) => isWithin(occurrence.effectiveDate, from, to))
    .sort(compareOccurrences)
}

export function nextPendingOccurrence(
  source: OccurrenceSource,
  today: string,
): Occurrence | null {
  const exceptions = exceptionsByOriginalDate(source.exceptions)
  let next: Occurrence | null = null
  for (const exception of source.exceptions) {
    if (
      exception.state !== 'overridden' ||
      !isOriginalDate(source.recurrence, exception.originalDate)
    ) {
      continue
    }
    const occurrence = resolveOccurrence(
      source,
      exception.originalDate,
      exception,
    )
    if (
      occurrence.effectiveDate >= today &&
      (next === null || compareOccurrences(occurrence, next) < 0)
    ) {
      next = occurrence
    }
  }
  for (const originalDate of originalDates(
    source.recurrence,
    addDays(today, -businessDayShiftMargin),
  )) {
    if (exceptions.has(originalDate)) {
      continue
    }
    const occurrence = resolveOccurrence(source, originalDate, undefined)
    if (occurrence.effectiveDate < today) {
      continue
    }
    if (next === null || compareOccurrences(occurrence, next) < 0) {
      next = occurrence
    }
    break
  }
  return next
}

export function orphanedExceptions(
  recurrence: Recurrence,
  exceptions: readonly OccurrenceException[],
): OccurrenceException[] {
  return exceptions.filter(
    (exception) =>
      exception.state !== 'executed' &&
      !isOriginalDate(recurrence, exception.originalDate),
  )
}
