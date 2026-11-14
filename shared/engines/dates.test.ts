import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonthsClamped,
  addMonthsToMonth,
  daysBetween,
  daysInMonth,
  earlierDate,
  enumerateDays,
  enumerateMonths,
  fromDayNumber,
  isLeapYear,
  isoDate,
  isoWeekday,
  isWithin,
  laterDate,
  monthEnd,
  monthsBetween,
  monthStart,
  parseIsoDate,
  toDayNumber,
} from './dates.js'

describe('civil dates', () => {
  it('parses and formats ISO dates', () => {
    expect(parseIsoDate('2026-11-11')).toEqual({
      year: 2026,
      month: 11,
      day: 11,
    })
    expect(isoDate(2027, 1, 4)).toBe('2027-01-04')
  })

  it.each([
    '2026-02-29',
    '2026-13-01',
    '2026-00-10',
    '2026-1-01',
    'today',
    '0999-12-31',
  ])('rejects %s', (date) => {
    expect(() => parseIsoDate(date)).toThrow(RangeError)
  })

  it('rejects non-integer components', () => {
    expect(() => isoDate(2026, 1.5, 1)).toThrow(RangeError)
  })

  it('applies the Gregorian leap year rules', () => {
    expect([2024, 2026, 2000, 2100].map(isLeapYear)).toEqual([
      true,
      false,
      true,
      false,
    ])
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2027, 2)).toBe(28)
    expect(daysInMonth(2026, 11)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('converts to and from day numbers', () => {
    expect(toDayNumber('1970-01-01')).toBe(0)
    expect(fromDayNumber(toDayNumber('2026-11-11'))).toBe('2026-11-11')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(daysBetween('2026-11-11', '2026-11-30')).toBe(19)
  })

  it('returns the ISO weekday, Monday being 1', () => {
    expect(isoWeekday('2026-11-11')).toBe(3)
    expect(isoWeekday('2027-01-25')).toBe(1)
    expect(isoWeekday('2026-11-15')).toBe(7)
  })

  it('adds months and clamps to the last day of the month', () => {
    expect(addMonthsClamped('2026-11-11', 3)).toBe('2027-02-11')
    expect(addMonthsClamped('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonthsClamped('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsClamped('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonthsClamped('2026-11-30', 14)).toBe('2028-01-30')
  })

  it('works with months', () => {
    expect(monthStart('2026-11-11')).toBe('2026-11-01')
    expect(monthEnd('2028-02-03')).toBe('2028-02-29')
    expect(addMonthsToMonth('2026-12-01', 1)).toBe('2027-01-01')
    expect(monthsBetween('2026-11-01', '2027-02-01')).toBe(3)
    expect(enumerateMonths('2026-11-15', '2027-01-03')).toEqual([
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
    ])
  })

  it('enumerates days inclusively', () => {
    expect(enumerateDays('2026-12-30', '2027-01-02')).toEqual([
      '2026-12-30',
      '2026-12-31',
      '2027-01-01',
      '2027-01-02',
    ])
    expect(enumerateDays('2026-12-30', '2026-12-29')).toEqual([])
  })

  it('compares dates', () => {
    expect(laterDate('2026-11-11', '2026-11-12')).toBe('2026-11-12')
    expect(laterDate('2026-11-12', '2026-11-11')).toBe('2026-11-12')
    expect(earlierDate('2026-11-11', '2026-11-12')).toBe('2026-11-11')
    expect(earlierDate('2026-11-12', '2026-11-11')).toBe('2026-11-11')
    expect(isWithin('2026-11-11', '2026-11-11', '2026-11-30')).toBe(true)
    expect(isWithin('2026-12-01', '2026-11-11', '2026-11-30')).toBe(false)
  })
})
