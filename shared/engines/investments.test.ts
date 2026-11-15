import { describe, expect, it } from 'vitest'
import { account, operation } from '../tests/engine-fixtures.js'
import {
  endOfDayBalances,
  latestValuation,
  referenceBalanceCents,
} from './balances.js'
import { investmentSummary, paidInCents } from './investments.js'

const pea = account({
  id: 'pea',
  usage: 'investment',
  initialBalanceCents: 100_000,
  initialBalanceDate: '2026-11-01',
  valuations: [
    { date: '2026-10-15', valueCents: 1 },
    { date: '2026-11-10', valueCents: 160_000 },
    { date: '2026-11-30', valueCents: 253_000 },
  ],
})

const operations = [
  operation({
    id: 'in-1',
    accountId: 'pea',
    date: '2026-11-06',
    amountCents: 70_000,
    transferGroupId: 'group-1',
  }),
  operation({
    id: 'in-2',
    accountId: 'pea',
    date: '2026-11-20',
    amountCents: 50_000,
    transferGroupId: 'group-2',
  }),
  operation({
    id: 'fees',
    accountId: 'pea',
    date: '2026-12-02',
    amountCents: -1_000,
  }),
  operation({
    id: 'out',
    accountId: 'pea',
    date: '2026-12-03',
    amountCents: -20_000,
    transferGroupId: 'group-3',
  }),
  operation({
    id: 'other-account',
    date: '2026-11-06',
    amountCents: -70_000,
    transferGroupId: 'group-1',
  }),
]

describe('valuations (CPT-06)', () => {
  it('takes the latest valuation dated from the initial balance date to the given date', () => {
    expect(latestValuation(pea, '2026-11-09')).toBeNull()
    expect(latestValuation(pea, '2026-11-10')).toEqual({
      date: '2026-11-10',
      valueCents: 160_000,
    })
    expect(latestValuation(pea, '2026-12-31')?.date).toBe('2026-11-30')
  })

  it('adds the flows after the latest valuation to it, or falls back on the calculated balance', () => {
    expect(referenceBalanceCents(pea, operations, '2026-11-09')).toBe(170_000)
    expect(referenceBalanceCents(pea, operations, '2026-11-25')).toBe(210_000)
    expect(referenceBalanceCents(pea, operations, '2026-12-03')).toBe(232_000)
    expect(referenceBalanceCents(pea, operations, '2026-10-31')).toBeNull()
  })

  it('restarts the daily balances from each valuation', () => {
    expect(
      endOfDayBalances(pea, operations, '2026-11-09', '2026-11-11').map(
        (day) => day.balanceCents,
      ),
    ).toEqual([170_000, 160_000, 160_000])
    expect(
      endOfDayBalances(pea, operations, '2026-11-29', '2026-12-02').map(
        (day) => day.balanceCents,
      ),
    ).toEqual([210_000, 253_000, 253_000, 252_000])
  })

  it('counts the initial balance and the transfers only as paid in', () => {
    expect(paidInCents(pea, operations, '2026-11-30')).toBe(220_000)
    expect(paidInCents(pea, operations, '2026-12-03')).toBe(200_000)
  })

  it('compares the reference balance with the amount paid in today', () => {
    expect(investmentSummary(pea, operations, '2026-12-03')).toEqual({
      paidInCents: 200_000,
      referenceBalanceCents: 232_000,
      lastValuation: { date: '2026-11-30', valueCents: 253_000 },
      latentGainCents: 32_000,
    })
  })

  it('shows no gain before the first valuation', () => {
    expect(investmentSummary(pea, operations, '2026-11-09')).toEqual({
      paidInCents: 170_000,
      referenceBalanceCents: 170_000,
      lastValuation: null,
      latentGainCents: null,
    })
  })
})
