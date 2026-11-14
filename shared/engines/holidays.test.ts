import { describe, expect, it } from 'vitest'
import { applyBusinessDayRule, isBusinessDay } from './business-days.js'
import {
  easterSunday,
  frenchPublicHolidays,
  isFrenchPublicHoliday,
} from './holidays.js'

describe('easterSunday', () => {
  it.each([
    [2008, '2008-03-23'],
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
    [2285, '2285-03-22'],
  ])('computes Easter %i on %s', (year, expected) => {
    expect(easterSunday(year)).toBe(expected)
  })
})

describe('frenchPublicHolidays (ECH-06)', () => {
  it('lists the eleven national holidays of 2027, movable feasts included', () => {
    expect(frenchPublicHolidays(2027)).toEqual([
      '2027-01-01',
      '2027-03-29',
      '2027-05-01',
      '2027-05-06',
      '2027-05-08',
      '2027-05-17',
      '2027-07-14',
      '2027-08-15',
      '2027-11-01',
      '2027-11-11',
      '2027-12-25',
    ])
  })

  it('places the 2026 movable feasts after Easter on 5 April', () => {
    expect(frenchPublicHolidays(2026)).toEqual(
      expect.arrayContaining(['2026-04-06', '2026-05-14', '2026-05-25']),
    )
  })

  it('excludes Good Friday and 26 December (Alsace-Moselle)', () => {
    expect(isFrenchPublicHoliday('2027-03-26')).toBe(false)
    expect(isFrenchPublicHoliday('2027-12-26')).toBe(false)
    expect(isFrenchPublicHoliday('2026-11-11')).toBe(true)
    expect(isFrenchPublicHoliday('2026-12-25')).toBe(true)
  })
})

describe('business days (ECH-06)', () => {
  it('excludes weekends and public holidays', () => {
    expect(isBusinessDay('2026-11-11')).toBe(false)
    expect(isBusinessDay('2026-11-12')).toBe(true)
    expect(isBusinessDay('2026-11-14')).toBe(false)
    expect(isBusinessDay('2026-11-15')).toBe(false)
  })

  it('keeps the exact date with the default rule', () => {
    expect(applyBusinessDayRule('2027-01-01', 'exact')).toBe('2027-01-01')
  })

  it('moves to the next business day', () => {
    expect(applyBusinessDayRule('2027-01-01', 'next')).toBe('2027-01-04')
    expect(applyBusinessDayRule('2027-03-27', 'next')).toBe('2027-03-30')
    expect(applyBusinessDayRule('2027-12-25', 'next')).toBe('2027-12-27')
    expect(applyBusinessDayRule('2027-02-01', 'next')).toBe('2027-02-01')
  })

  it('moves to the previous business day', () => {
    expect(applyBusinessDayRule('2027-01-01', 'previous')).toBe('2026-12-31')
    expect(applyBusinessDayRule('2027-05-01', 'previous')).toBe('2027-04-30')
    expect(applyBusinessDayRule('2027-12-25', 'previous')).toBe('2027-12-24')
  })
})
