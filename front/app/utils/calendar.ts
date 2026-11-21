import { isBusinessDay } from '@mint/shared/engines/business-days'
import {
  addDays,
  isoWeekday,
  monthEnd,
  monthStart,
} from '@mint/shared/engines/dates'
import type { CalendarDay } from '@mint/shared/types/forecast'
import type {
  CalendarAlert,
  CalendarCell,
  CalendarDotKind,
  CalendarMonthRange,
} from '~~/types/forecast'

export const calendarOccurrencesPerCell = 3

export function calendarCells(
  month: string,
  days: readonly CalendarDay[],
  range: CalendarMonthRange,
): CalendarCell[] {
  const byDate = new Map(days.map((day) => [day.date, day]))
  const first = addDays(monthStart(month), 1 - isoWeekday(monthStart(month)))
  const last = addDays(monthEnd(month), 7 - isoWeekday(monthEnd(month)))
  const cells: CalendarCell[] = []
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const inMonth = date >= monthStart(month) && date <= monthEnd(month)
    const cellMonth = monthStart(date)
    cells.push({
      date,
      inMonth,
      selectable:
        inMonth ||
        (cellMonth >= range.firstMonth && cellMonth <= range.lastMonth),
      day: inMonth ? (byDate.get(date) ?? null) : null,
      nonWorking: !isBusinessDay(date),
    })
  }
  return cells
}

export function calendarAlert(
  balanceCents: number | null,
  thresholdCents: number | null,
): CalendarAlert {
  if (balanceCents === null) {
    return 'none'
  }
  if (balanceCents < 0) {
    return 'negative'
  }
  return thresholdCents !== null && balanceCents < thresholdCents
    ? 'belowThreshold'
    : 'none'
}

export function calendarDots(day: CalendarDay): CalendarDotKind[] {
  const amounts =
    day.period === 'past'
      ? day.operations.map((operation) => operation.amountCents)
      : [
          ...day.occurrences.map((occurrence) => occurrence.amountCents),
          ...day.operations.map((operation) => operation.amountCents),
        ]
  const dots: CalendarDotKind[] = []
  if (amounts.some((amount) => amount > 0)) {
    dots.push('credit')
  }
  if (amounts.some((amount) => amount < 0)) {
    dots.push('debit')
  }
  if (
    day.occurrences.some((occurrence) => occurrence.triggerMode === 'manual')
  ) {
    dots.push('manual')
  }
  return dots
}

export function operationsTotalCents(day: CalendarDay): number {
  return day.operations.reduce(
    (total, operation) => total + operation.amountCents,
    0,
  )
}

export function hasCalendarContent(day: CalendarDay | null): boolean {
  return day !== null && day.period !== 'beyond' && day.balanceCents !== null
}
