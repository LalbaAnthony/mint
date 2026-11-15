import { describe, expect, it } from 'vitest'
import type { Account } from '@mint/shared/types/accounts'
import { parisDate } from '../clock.js'
import { buildAccountOverview } from './accounts.js'

function account(overrides: Partial<Account>): Account {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Compte',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: null,
    initialBalanceCents: 0,
    initialBalanceDate: '2026-11-11',
    lowBalanceThresholdCents: null,
    sortOrder: 0,
    archivedAt: null,
    currentBalanceCents: 0,
    reconciliationGapCents: null,
    investment: null,
    ...overrides,
  }
}

describe('buildAccountOverview (CPT-08)', () => {
  it('groups the US-04 accounts by usage with subtotals and a total of 19 000 EUR', () => {
    const overview = buildAccountOverview([
      account({
        id: 'a',
        name: 'Livret A',
        usage: 'savings',
        currentBalanceCents: 1_200_000,
      }),
      account({
        id: 'b',
        name: 'Compte courant',
        usage: 'current',
        currentBalanceCents: 200_000,
      }),
      account({
        id: 'c',
        name: 'LEP',
        usage: 'emergency',
        currentBalanceCents: 500_000,
      }),
    ])

    expect(
      overview.groups.map((group) => [group.usage, group.subtotalCents]),
    ).toEqual([
      ['current', 200_000],
      ['emergency', 500_000],
      ['savings', 1_200_000],
    ])
    expect(overview.totalCents).toBe(1_900_000)
    expect(overview.archived).toEqual([])
  })

  it('keeps the given order inside a group and leaves archived accounts out of the totals (CPT-07)', () => {
    const overview = buildAccountOverview([
      account({ id: 'first', usage: 'current', currentBalanceCents: -5_000 }),
      account({
        id: 'archived',
        usage: 'current',
        currentBalanceCents: 99_999,
        archivedAt: '2026-11-10T10:00:00.000Z',
      }),
      account({ id: 'second', usage: 'current', currentBalanceCents: 15_000 }),
    ])

    expect(overview.groups).toHaveLength(1)
    expect(overview.groups[0]?.accounts.map((item) => item.id)).toEqual([
      'first',
      'second',
    ])
    expect(overview.groups[0]?.subtotalCents).toBe(10_000)
    expect(overview.totalCents).toBe(10_000)
    expect(overview.archived.map((item) => item.id)).toEqual(['archived'])
  })

  it('returns no group and a zero total without account', () => {
    expect(buildAccountOverview([])).toEqual({
      totalCents: 0,
      groups: [],
      archived: [],
    })
  })
})

describe('parisDate', () => {
  it('reads the calendar date in Europe/Paris', () => {
    expect(parisDate(new Date('2026-11-11T22:59:59Z'))).toBe('2026-11-11')
    expect(parisDate(new Date('2026-11-11T23:00:00Z'))).toBe('2026-11-12')
    expect(parisDate(new Date('2026-07-01T21:59:59Z'))).toBe('2026-07-01')
    expect(parisDate(new Date('2026-07-01T22:00:00Z'))).toBe('2026-07-02')
  })
})
