import type { BusinessDayRule } from '../types/schedules.js'
import { addDays, isoWeekday } from './dates.js'
import { isFrenchPublicHoliday } from './holidays.js'

export function isBusinessDay(date: string): boolean {
  return isoWeekday(date) <= 5 && !isFrenchPublicHoliday(date)
}

function shiftToBusinessDay(date: string, step: 1 | -1): string {
  let candidate = date
  while (!isBusinessDay(candidate)) {
    candidate = addDays(candidate, step)
  }
  return candidate
}

export function applyBusinessDayRule(
  date: string,
  rule: BusinessDayRule,
): string {
  switch (rule) {
    case 'exact':
      return date
    case 'previous':
      return shiftToBusinessDay(date, -1)
    case 'next':
      return shiftToBusinessDay(date, 1)
  }
}
