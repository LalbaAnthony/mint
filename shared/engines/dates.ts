import type { CivilDate, IsoWeekday, YearMonth } from '../types/dates.js'

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const millisecondsPerDay = 86_400_000
const minimumYear = 1000

const isoWeekdays: readonly IsoWeekday[] = [7, 1, 2, 3, 4, 5, 6]

function pad(value: number, length: number): string {
  return String(value).padStart(length, '0')
}

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function isoDate(year: number, month: number, day: number): string {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < minimumYear ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new RangeError(`Invalid civil date ${year}-${month}-${day}`)
  }
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`
}

export function parseIsoDate(date: string): CivilDate {
  const match = isoDatePattern.exec(date)
  if (match === null) {
    throw new RangeError(`Invalid ISO date ${date}`)
  }
  const civil = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  }
  isoDate(civil.year, civil.month, civil.day)
  return civil
}

export function toDayNumber(date: string): number {
  const { year, month, day } = parseIsoDate(date)
  return Date.UTC(year, month - 1, day) / millisecondsPerDay
}

export function fromDayNumber(dayNumber: number): string {
  const instant = new Date(dayNumber * millisecondsPerDay)
  return isoDate(
    instant.getUTCFullYear(),
    instant.getUTCMonth() + 1,
    instant.getUTCDate(),
  )
}

export function addDays(date: string, days: number): string {
  return fromDayNumber(toDayNumber(date) + days)
}

export function daysBetween(from: string, to: string): number {
  return toDayNumber(to) - toDayNumber(from)
}

export function isoWeekday(date: string): IsoWeekday {
  const weekday =
    isoWeekdays[new Date(toDayNumber(date) * millisecondsPerDay).getUTCDay()]
  if (weekday === undefined) {
    throw new RangeError(`No weekday for ${date}`)
  }
  return weekday
}

export function shiftMonth(
  year: number,
  month: number,
  months: number,
): YearMonth {
  const monthIndex = year * 12 + (month - 1) + months
  return { year: Math.floor(monthIndex / 12), month: (monthIndex % 12) + 1 }
}

export function clampedDate(year: number, month: number, day: number): string {
  return isoDate(year, month, Math.min(day, daysInMonth(year, month)))
}

export function addMonthsClamped(date: string, months: number): string {
  const civil = parseIsoDate(date)
  const target = shiftMonth(civil.year, civil.month, months)
  return clampedDate(target.year, target.month, civil.day)
}

export function monthStart(date: string): string {
  const { year, month } = parseIsoDate(date)
  return isoDate(year, month, 1)
}

export function monthEnd(date: string): string {
  const { year, month } = parseIsoDate(date)
  return isoDate(year, month, daysInMonth(year, month))
}

export function addMonthsToMonth(month: string, months: number): string {
  return monthStart(addMonthsClamped(monthStart(month), months))
}

export function monthsBetween(fromMonth: string, toMonth: string): number {
  const from = parseIsoDate(fromMonth)
  const to = parseIsoDate(toMonth)
  return (to.year - from.year) * 12 + (to.month - from.month)
}

export function enumerateDays(from: string, to: string): string[] {
  const first = toDayNumber(from)
  const last = toDayNumber(to)
  const days: string[] = []
  for (let dayNumber = first; dayNumber <= last; dayNumber += 1) {
    days.push(fromDayNumber(dayNumber))
  }
  return days
}

export function enumerateMonths(fromMonth: string, toMonth: string): string[] {
  const count = monthsBetween(monthStart(fromMonth), monthStart(toMonth))
  const months: string[] = []
  for (let offset = 0; offset <= count; offset += 1) {
    months.push(addMonthsToMonth(fromMonth, offset))
  }
  return months
}

export function laterDate(first: string, second: string): string {
  return first > second ? first : second
}

export function earlierDate(first: string, second: string): string {
  return first < second ? first : second
}

export function isWithin(date: string, from: string, to: string): boolean {
  return date >= from && date <= to
}
