import { describe, expect, it } from 'vitest'
import {
  categories,
  envelope,
  operation,
  today,
} from '../tests/engine-fixtures.js'
import {
  envelopeBudgetCents,
  envelopeCategoryIndex,
  envelopeDailyShares,
  envelopeMonthStatus,
} from './envelopes.js'

const groceries = envelope({ id: 'groceries-envelope' })
const index = envelopeCategoryIndex([groceries], categories)

function spending(date: string, amountCents: number, categoryId = 'groceries') {
  return operation({
    id: `${date}-${amountCents}`,
    date,
    amountCents,
    categoryId,
  })
}

describe('envelopeCategoryIndex (ENV-01)', () => {
  it('includes the subcategories of an envelope category', () => {
    expect(Object.fromEntries(index)).toEqual({
      groceries: 'groceries-envelope',
      drive: 'groceries-envelope',
    })
  })

  it('lets the most specific category win', () => {
    const drive = envelope({ id: 'drive-envelope', categoryIds: ['drive'] })

    expect(
      Object.fromEntries(envelopeCategoryIndex([groceries, drive], categories)),
    ).toEqual({ groceries: 'groceries-envelope', drive: 'drive-envelope' })
  })

  it('ignores inactive envelopes', () => {
    expect(
      envelopeCategoryIndex([envelope({ active: false })], categories).size,
    ).toBe(0)
  })
})

describe('envelopeMonthStatus (ENV-03 to ENV-05)', () => {
  it('subtracts debits and adds back refunds of the month, all origins included', () => {
    expect(
      envelopeMonthStatus(
        groceries,
        '2026-11-01',
        [
          spending('2026-11-03', -12_000),
          spending('2026-11-08', 2_000, 'drive'),
          spending('2026-10-31', -9_999),
          spending('2026-11-05', -500, 'leisure'),
          operation({ date: '2026-11-04', amountCents: -700 }),
        ],
        index,
      ),
    ).toEqual({
      envelopeId: 'groceries-envelope',
      month: '2026-11-01',
      budgetCents: 30_000,
      carriedOverCents: 0,
      consumedCents: 10_000,
      availableCents: 20_000,
    })
  })

  it('starts each month from the monthly amount in reset mode', () => {
    expect(
      envelopeMonthStatus(
        groceries,
        '2026-11-01',
        [spending('2026-10-03', -40_000)],
        index,
      ).availableCents,
    ).toBe(30_000)
  })

  it('carries the positive or negative remainder over from the creation month', () => {
    const carried = envelope({
      id: 'groceries-envelope',
      carryOver: true,
      createdOn: '2026-09-15',
    })
    const operations = [
      spending('2026-08-20', -30_000),
      spending('2026-09-20', -25_000),
      spending('2026-10-10', -40_000),
      spending('2026-11-03', -12_000),
    ]

    expect(
      envelopeMonthStatus(carried, '2026-11-01', operations, index),
    ).toEqual({
      envelopeId: 'groceries-envelope',
      month: '2026-11-01',
      budgetCents: 30_000,
      carriedOverCents: -5_000,
      consumedCents: 12_000,
      availableCents: 13_000,
    })
    expect(
      envelopeMonthStatus(carried, '2026-08-01', operations, index)
        .carriedOverCents,
    ).toBe(0)
  })

  it('uses the monthly override when there is one (ENV-07)', () => {
    const overridden = envelope({
      monthOverrides: [{ month: '2026-12-01', amountCents: 45_000 }],
    })

    expect(envelopeBudgetCents(overridden, '2026-12-01')).toBe(45_000)
    expect(envelopeBudgetCents(overridden, '2027-01-01')).toBe(30_000)
  })
})

describe('envelopeDailyShares (PRV-04)', () => {
  function shares(
    overrides: Partial<Parameters<typeof envelopeDailyShares>[0]> = {},
  ) {
    return envelopeDailyShares({
      today,
      endDate: '2027-01-31',
      envelopes: [groceries],
      categoryIndex: index,
      operations: [],
      commitments: [],
      ...overrides,
    })
  }

  function totalBetween(
    list: ReturnType<typeof shares>,
    from: string,
    to: string,
  ): number {
    return list
      .filter((share) => share.date >= from && share.date <= to)
      .reduce((total, share) => total + share.amountCents, 0)
  }

  it('subtracts future occurrences of the current month from what remains', () => {
    const list = shares({
      operations: [spending('2026-11-03', -12_000)],
      commitments: [spending('2026-11-20', -8_000, 'drive')],
    })

    expect(totalBetween(list, '2026-11-11', '2026-11-30')).toBe(10_000)
    expect(list.find((share) => share.date === '2026-11-11')).toEqual({
      envelopeId: 'groceries-envelope',
      label: 'Courses',
      accountId: 'current',
      date: '2026-11-11',
      amountCents: 500,
    })
  })

  it('never debits more than zero once the envelope is exhausted', () => {
    const list = shares({ operations: [spending('2026-11-03', -35_000)] })

    expect(totalBetween(list, '2026-11-01', '2026-11-30')).toBe(0)
  })

  it('subtracts recorded operations and occurrences from future months too', () => {
    const list = shares({
      operations: [spending('2026-12-24', -6_000)],
      commitments: [
        spending('2026-12-05', -5_000),
        spending('2027-01-05', -5_000),
      ],
    })

    expect(totalBetween(list, '2026-12-01', '2026-12-31')).toBe(19_000)
    expect(totalBetween(list, '2027-01-01', '2027-01-31')).toBe(25_000)
  })

  it('does not project the carry-over on future months', () => {
    const list = shares({
      envelopes: [
        envelope({
          id: 'groceries-envelope',
          carryOver: true,
          createdOn: '2026-10-01',
        }),
      ],
      operations: [spending('2026-10-03', -10_000)],
    })

    expect(totalBetween(list, '2026-11-11', '2026-11-30')).toBe(50_000)
    expect(totalBetween(list, '2026-12-01', '2026-12-31')).toBe(30_000)
  })

  it('stops at the end of the horizon and skips inactive envelopes', () => {
    const list = shares({ endDate: '2026-12-10' })

    expect(list.at(-1)?.date).toBe('2026-12-10')
    expect(
      list.filter((share) => share.date.startsWith('2026-12')),
    ).toHaveLength(10)
    expect(shares({ envelopes: [envelope({ active: false })] })).toEqual([])
  })
})
