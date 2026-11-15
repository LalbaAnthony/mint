import { describe, expect, it } from 'vitest'
import { account, operation } from '../tests/engine-fixtures.js'
import {
  aggregateEndOfDayBalances,
  calculatedBalanceCents,
  endOfDayBalances,
} from './balances.js'

const checking = account({
  initialBalanceCents: 100_000,
  initialBalanceDate: '2026-11-01',
})

const operations = [
  operation({ id: 'before', date: '2026-10-31', amountCents: -5_000 }),
  operation({ id: 'same-day', date: '2026-11-01', amountCents: -1_000 }),
  operation({ id: 'later', date: '2026-11-05', amountCents: 2_000 }),
  operation({
    id: 'other-account',
    accountId: 'livret-a',
    date: '2026-11-02',
    amountCents: 7_000,
  }),
]

describe('calculatedBalanceCents (CPT-04)', () => {
  it('adds the operations dated from the initial balance date to the given date', () => {
    expect(calculatedBalanceCents(checking, operations, '2026-11-01')).toBe(
      99_000,
    )
    expect(calculatedBalanceCents(checking, operations, '2026-11-04')).toBe(
      99_000,
    )
    expect(calculatedBalanceCents(checking, operations, '2026-11-05')).toBe(
      101_000,
    )
  })

  it('has no balance before the initial balance date', () => {
    expect(
      calculatedBalanceCents(checking, operations, '2026-10-31'),
    ).toBeNull()
  })
})

describe('endOfDayBalances (PRV-09)', () => {
  it('gives the real end-of-day balance of each past day', () => {
    expect(
      endOfDayBalances(checking, operations, '2026-10-30', '2026-11-06'),
    ).toEqual([
      { date: '2026-10-30', balanceCents: null },
      { date: '2026-10-31', balanceCents: null },
      { date: '2026-11-01', balanceCents: 99_000 },
      { date: '2026-11-02', balanceCents: 99_000 },
      { date: '2026-11-03', balanceCents: 99_000 },
      { date: '2026-11-04', balanceCents: 99_000 },
      { date: '2026-11-05', balanceCents: 101_000 },
      { date: '2026-11-06', balanceCents: 101_000 },
    ])
  })

  it('starts from the balance of the first requested day', () => {
    expect(
      endOfDayBalances(checking, operations, '2026-11-05', '2026-11-06'),
    ).toEqual([
      { date: '2026-11-05', balanceCents: 101_000 },
      { date: '2026-11-06', balanceCents: 101_000 },
    ])
  })

  it('returns nothing for an empty range', () => {
    expect(
      endOfDayBalances(checking, operations, '2026-11-06', '2026-11-05'),
    ).toEqual([])
  })
})

describe('aggregateEndOfDayBalances (PRV-05, PRV-09)', () => {
  const livretA = account({
    id: 'livret-a',
    usage: 'savings',
    initialBalanceCents: 50_000,
    initialBalanceDate: '2026-11-02',
  })

  it('adds the accounts that already have a balance on each day', () => {
    expect(
      aggregateEndOfDayBalances(
        [checking, livretA],
        operations,
        '2026-10-31',
        '2026-11-02',
      ),
    ).toEqual([
      { date: '2026-10-31', balanceCents: null },
      { date: '2026-11-01', balanceCents: 99_000 },
      { date: '2026-11-02', balanceCents: 156_000 },
    ])
  })

  it('has no balance without any account', () => {
    expect(
      aggregateEndOfDayBalances([], operations, '2026-11-01', '2026-11-01'),
    ).toEqual([{ date: '2026-11-01', balanceCents: null }])
  })
})
