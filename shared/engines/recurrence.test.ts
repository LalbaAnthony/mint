import { describe, expect, it } from 'vitest'
import { exception, recurrence, schedule } from '../tests/engine-fixtures.js'
import {
  isOriginalDate,
  nextPendingOccurrence,
  occurrencesBetween,
  orphanedExceptions,
  originalDateAt,
  originalDatesBetween,
  resolveOccurrence,
} from './recurrence.js'

describe('original dates (ECH-04)', () => {
  it('anchors weekly recurrences on the weekday of the start date', () => {
    expect(
      originalDatesBetween(
        recurrence({ frequency: 'weekly', startDate: '2026-01-07' }),
        '2026-11-01',
        '2026-11-30',
      ),
    ).toEqual(['2026-11-04', '2026-11-11', '2026-11-18', '2026-11-25'])
    expect(
      originalDatesBetween(
        recurrence({
          frequency: 'weekly',
          interval: 2,
          startDate: '2026-11-11',
        }),
        '2026-11-01',
        '2026-12-31',
      ),
    ).toEqual(['2026-11-11', '2026-11-25', '2026-12-09', '2026-12-23'])
  })

  it('keeps the anchor day of the month and falls back to the last day when absent', () => {
    expect(
      originalDatesBetween(
        recurrence({ startDate: '2027-01-31' }),
        '2027-01-01',
        '2027-05-31',
      ),
    ).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
      '2027-05-31',
    ])
  })

  it('skips months with an interval of N months', () => {
    expect(
      originalDatesBetween(
        recurrence({ interval: 2, startDate: '2026-11-30' }),
        '2026-12-01',
        '2027-05-31',
      ),
    ).toEqual(['2027-01-30', '2027-03-30', '2027-05-30'])
  })

  it('uses the last day of each month with the last-day option', () => {
    expect(
      originalDatesBetween(
        recurrence({ startDate: '2027-01-15', anchorLastDay: true }),
        '2027-01-01',
        '2027-03-31',
      ),
    ).toEqual(['2027-01-31', '2027-02-28', '2027-03-31'])
    expect(
      originalDateAt(
        recurrence({
          frequency: 'yearly',
          startDate: '2027-02-10',
          anchorLastDay: true,
        }),
        1,
      ),
    ).toBe('2028-02-29')
  })

  it('anchors yearly recurrences on day and month, 29 February giving 28 February', () => {
    expect(
      originalDatesBetween(
        recurrence({ frequency: 'yearly', startDate: '2028-02-29' }),
        '2028-01-01',
        '2032-12-31',
      ),
    ).toEqual([
      '2028-02-29',
      '2029-02-28',
      '2030-02-28',
      '2031-02-28',
      '2032-02-29',
    ])
    expect(
      originalDatesBetween(
        recurrence({
          frequency: 'yearly',
          interval: 2,
          startDate: '2026-03-15',
        }),
        '2026-01-01',
        '2031-12-31',
      ),
    ).toEqual(['2026-03-15', '2028-03-15', '2030-03-15'])
  })

  it('produces a single date for a one-off schedule', () => {
    const once = recurrence({ frequency: 'once', startDate: '2026-12-24' })

    expect(originalDatesBetween(once, '2026-01-01', '2027-12-31')).toEqual([
      '2026-12-24',
    ])
    expect(originalDatesBetween(once, '2026-12-25', '2027-12-31')).toEqual([])
    expect(originalDatesBetween(once, '2026-01-01', '2026-12-23')).toEqual([])
  })

  it('stops at the end date, compared to the original date', () => {
    expect(
      originalDatesBetween(
        recurrence({ startDate: '2026-11-05', endDate: '2027-01-05' }),
        '2026-01-01',
        '2027-12-31',
      ),
    ).toEqual(['2026-11-05', '2026-12-05', '2027-01-05'])
  })

  it('stops after the maximum number of occurrences', () => {
    const limited = recurrence({ startDate: '2026-11-05', maxOccurrences: 2 })

    expect(originalDatesBetween(limited, '2026-01-01', '2027-12-31')).toEqual([
      '2026-11-05',
      '2026-12-05',
    ])
    expect(originalDatesBetween(limited, '2027-01-01', '2027-12-31')).toEqual(
      [],
    )
  })

  it('tells whether a date belongs to the recurrence', () => {
    const monthly = recurrence({ startDate: '2026-11-05' })

    expect(isOriginalDate(monthly, '2027-03-05')).toBe(true)
    expect(isOriginalDate(monthly, '2027-03-06')).toBe(false)
    expect(isOriginalDate(monthly, '2026-10-05')).toBe(false)
  })

  it('rejects an invalid interval or occurrence count', () => {
    expect(() =>
      originalDatesBetween(
        recurrence({ interval: 0 }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toThrow(RangeError)
    expect(() =>
      originalDatesBetween(
        recurrence({ maxOccurrences: 0 }),
        '2026-01-01',
        '2026-12-31',
      ),
    ).toThrow(RangeError)
  })
})

describe('occurrences (ECH-06, ECH-07)', () => {
  it('applies the business-day rule to compute the effective date', () => {
    const rent = schedule({
      recurrence: recurrence({
        startDate: '2027-01-31',
        businessDayRule: 'next',
        endDate: '2027-01-31',
      }),
    })

    expect(occurrencesBetween(rent, '2027-01-01', '2027-02-28')).toEqual([
      {
        originalDate: '2027-01-31',
        effectiveDate: '2027-02-01',
        amountCents: 10_000,
        status: 'pending',
        overridden: false,
      },
    ])
  })

  it('selects occurrences by effective date, previous rule included', () => {
    const rent = schedule({
      recurrence: recurrence({
        startDate: '2027-04-01',
        businessDayRule: 'previous',
      }),
    })

    expect(
      occurrencesBetween(rent, '2027-04-30', '2027-04-30').map(
        (occurrence) => occurrence.originalDate,
      ),
    ).toEqual(['2027-05-01'])
    expect(occurrencesBetween(rent, '2027-05-01', '2027-05-31')).toEqual([])
  })

  it('overrides the amount or the date of one occurrence, the date taken as is', () => {
    const income = schedule({
      exceptions: [
        exception({ originalDate: '2026-12-05', amountCents: 18_000 }),
        exception({ originalDate: '2027-01-05', effectiveDate: '2027-01-09' }),
      ],
    })

    expect(occurrencesBetween(income, '2026-12-01', '2027-01-31')).toEqual([
      {
        originalDate: '2026-12-05',
        effectiveDate: '2026-12-05',
        amountCents: 18_000,
        status: 'pending',
        overridden: true,
      },
      {
        originalDate: '2027-01-05',
        effectiveDate: '2027-01-09',
        amountCents: 10_000,
        status: 'pending',
        overridden: true,
      },
    ])
  })

  it('follows a date override far from its original date', () => {
    const moved = schedule({
      exceptions: [
        exception({ originalDate: '2027-03-05', effectiveDate: '2027-01-20' }),
      ],
    })

    expect(
      occurrencesBetween(moved, '2027-01-01', '2027-01-31').map(
        (occurrence) => [occurrence.originalDate, occurrence.effectiveDate],
      ),
    ).toEqual([
      ['2027-01-05', '2027-01-05'],
      ['2027-03-05', '2027-01-20'],
    ])
    expect(
      occurrencesBetween(moved, '2027-03-01', '2027-03-31').map(
        (occurrence) => occurrence.originalDate,
      ),
    ).toEqual([])
  })

  it('reports skipped and executed occurrences with their status', () => {
    const recurring = schedule({
      exceptions: [
        exception({ originalDate: '2026-12-05', state: 'skipped' }),
        exception({
          originalDate: '2027-01-05',
          state: 'executed',
          effectiveDate: '2027-01-04',
          amountCents: 9_000,
        }),
      ],
    })

    expect(
      occurrencesBetween(recurring, '2026-12-01', '2027-01-31').map(
        ({ originalDate, effectiveDate, amountCents, status }) => ({
          originalDate,
          effectiveDate,
          amountCents,
          status,
        }),
      ),
    ).toEqual([
      {
        originalDate: '2026-12-05',
        effectiveDate: '2026-12-05',
        amountCents: 10_000,
        status: 'skipped',
      },
      {
        originalDate: '2027-01-05',
        effectiveDate: '2027-01-04',
        amountCents: 9_000,
        status: 'executed',
      },
    ])
  })

  it('counts skipped occurrences in the maximum number of occurrences', () => {
    const limited = schedule({
      recurrence: recurrence({ startDate: '2026-11-05', maxOccurrences: 3 }),
      exceptions: [exception({ originalDate: '2026-12-05', state: 'skipped' })],
    })

    expect(
      occurrencesBetween(limited, '2026-01-01', '2027-12-31').map(
        (occurrence) => [occurrence.originalDate, occurrence.status],
      ),
    ).toEqual([
      ['2026-11-05', 'pending'],
      ['2026-12-05', 'skipped'],
      ['2027-01-05', 'pending'],
    ])
  })

  it('ignores an exception whose original date is not in the recurrence', () => {
    const recurring = schedule({
      exceptions: [
        exception({ originalDate: '2027-01-06', effectiveDate: '2027-01-10' }),
      ],
    })

    expect(
      occurrencesBetween(recurring, '2027-01-01', '2027-01-31').map(
        (occurrence) => occurrence.originalDate,
      ),
    ).toEqual(['2027-01-05'])
  })

  it('returns nothing for an empty window', () => {
    expect(occurrencesBetween(schedule(), '2027-01-31', '2027-01-01')).toEqual(
      [],
    )
  })

  it('resolves an occurrence without exception', () => {
    expect(resolveOccurrence(schedule(), '2026-12-05', undefined)).toEqual({
      originalDate: '2026-12-05',
      effectiveDate: '2026-12-05',
      amountCents: 10_000,
      status: 'pending',
      overridden: false,
    })
  })
})

describe('nextPendingOccurrence (ECH-09)', () => {
  it('returns the first pending occurrence on or after today', () => {
    expect(nextPendingOccurrence(schedule(), '2026-12-05')?.originalDate).toBe(
      '2026-12-05',
    )
    expect(nextPendingOccurrence(schedule(), '2026-12-06')?.originalDate).toBe(
      '2027-01-05',
    )
  })

  it('skips skipped and executed occurrences', () => {
    const recurring = schedule({
      exceptions: [
        exception({ originalDate: '2026-12-05', state: 'skipped' }),
        exception({
          originalDate: '2027-01-05',
          state: 'executed',
          effectiveDate: '2027-01-05',
          amountCents: 10_000,
        }),
      ],
    })

    expect(nextPendingOccurrence(recurring, '2026-11-11')?.originalDate).toBe(
      '2027-02-05',
    )
  })

  it('takes an occurrence moved earlier into account', () => {
    const moved = schedule({
      exceptions: [
        exception({ originalDate: '2027-01-05', effectiveDate: '2026-11-20' }),
        exception({ originalDate: '2027-02-05', effectiveDate: '2026-11-01' }),
        exception({ originalDate: '2027-02-06', effectiveDate: '2026-11-12' }),
      ],
    })

    expect(nextPendingOccurrence(moved, '2026-11-11')).toEqual({
      originalDate: '2027-01-05',
      effectiveDate: '2026-11-20',
      amountCents: 10_000,
      status: 'pending',
      overridden: true,
    })
  })

  it('returns null once the recurrence is over', () => {
    expect(
      nextPendingOccurrence(
        schedule({
          recurrence: recurrence({
            frequency: 'once',
            startDate: '2026-11-05',
          }),
        }),
        '2026-11-11',
      ),
    ).toBeNull()
    expect(
      nextPendingOccurrence(
        schedule({ recurrence: recurrence({ endDate: '2026-12-05' }) }),
        '2026-12-06',
      ),
    ).toBeNull()
  })
})

describe('orphanedExceptions (ECH-08)', () => {
  it('lists the pending exceptions whose original date no longer exists', () => {
    const exceptions = [
      exception({ originalDate: '2026-12-05', amountCents: 9_000 }),
      exception({ originalDate: '2027-01-05', state: 'skipped' }),
      exception({
        originalDate: '2026-11-05',
        state: 'executed',
        effectiveDate: '2026-11-05',
        amountCents: 10_000,
      }),
      exception({ originalDate: '2027-02-06', amountCents: 9_000 }),
    ]

    expect(
      orphanedExceptions(recurrence({ startDate: '2026-11-06' }), exceptions),
    ).toEqual([exceptions[0], exceptions[1]])
  })
})
