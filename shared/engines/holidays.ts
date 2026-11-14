import { addDays, isoDate, parseIsoDate } from './dates.js'

const holidaysByYear = new Map<number, ReadonlySet<string>>()

export function easterSunday(year: number): string {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const monthAndDay = h + l - 7 * m + 114
  return isoDate(year, Math.floor(monthAndDay / 31), (monthAndDay % 31) + 1)
}

export function frenchPublicHolidays(year: number): string[] {
  const easter = easterSunday(year)
  return [
    isoDate(year, 1, 1),
    addDays(easter, 1),
    isoDate(year, 5, 1),
    isoDate(year, 5, 8),
    addDays(easter, 39),
    addDays(easter, 50),
    isoDate(year, 7, 14),
    isoDate(year, 8, 15),
    isoDate(year, 11, 1),
    isoDate(year, 11, 11),
    isoDate(year, 12, 25),
  ].sort()
}

function holidaysOf(year: number): ReadonlySet<string> {
  const cached = holidaysByYear.get(year)
  if (cached !== undefined) {
    return cached
  }
  const holidays = new Set(frenchPublicHolidays(year))
  holidaysByYear.set(year, holidays)
  return holidays
}

export function isFrenchPublicHoliday(date: string): boolean {
  return holidaysOf(parseIsoDate(date).year).has(date)
}
