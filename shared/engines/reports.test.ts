import { describe, expect, it } from 'vitest'
import {
  account,
  categories,
  category,
  operation,
} from '../tests/engine-fixtures.js'
import {
  monthlyIncomeExpenses,
  savingsTransfersCents,
  spendingBreakdown,
} from './reports.js'

const accounts = [
  account({ id: 'current', usage: 'current' }),
  account({ id: 'other-current', usage: 'current' }),
  account({ id: 'lep', usage: 'emergency' }),
  account({ id: 'livret-a', usage: 'savings' }),
  account({ id: 'pea', usage: 'investment' }),
]

function transfer(
  group: string,
  from: string,
  to: string,
  amountCents: number,
  date = '2026-11-06',
) {
  return [
    operation({
      id: `${group}-debit`,
      accountId: from,
      date,
      amountCents: -amountCents,
      transferGroupId: group,
    }),
    operation({
      id: `${group}-credit`,
      accountId: to,
      date,
      amountCents,
      transferGroupId: group,
    }),
  ]
}

describe('savingsTransfersCents (CAT-03)', () => {
  it('sums the transfers from a current account to a savings, emergency or investment account', () => {
    expect(
      savingsTransfersCents(
        [
          ...transfer('to-livret', 'current', 'livret-a', 10_000),
          ...transfer('to-lep', 'current', 'lep', 5_000),
          ...transfer('to-pea', 'current', 'pea', 2_000),
          ...transfer('withdrawal', 'livret-a', 'current', 7_000),
          ...transfer('between-current', 'current', 'other-current', 3_000),
          ...transfer('outside', 'current', 'livret-a', 1_000, '2026-12-01'),
        ],
        accounts,
        '2026-11-01',
        '2026-11-30',
      ),
    ).toBe(17_000)
  })

  it('rejects an incomplete transfer or an unknown account', () => {
    const [debit] = transfer('half', 'current', 'livret-a', 10_000)

    expect(() =>
      savingsTransfersCents(
        debit === undefined ? [] : [debit],
        accounts,
        '2026-11-01',
        '2026-11-30',
      ),
    ).toThrow(RangeError)
    expect(() =>
      savingsTransfersCents(
        transfer('unknown', 'current', 'missing', 10_000),
        accounts,
        '2026-11-01',
        '2026-11-30',
      ),
    ).toThrow(RangeError)
  })
})

describe('spendingBreakdown (DSH-02)', () => {
  it('splits the expenses of the period into Needs and Wants by top-level category', () => {
    const breakdown = spendingBreakdown({
      from: '2026-11-01',
      to: '2026-11-30',
      categories,
      accounts,
      operations: [
        operation({ id: '1', amountCents: -4_000, categoryId: 'groceries' }),
        operation({ id: '2', amountCents: -1_000, categoryId: 'drive' }),
        operation({ id: '3', amountCents: 500, categoryId: 'groceries' }),
        operation({ id: '4', amountCents: -60_000, categoryId: 'housing' }),
        operation({ id: '5', amountCents: -2_500, categoryId: 'restaurants' }),
        operation({ id: '6', amountCents: -1_250, categoryId: 'adjustment' }),
        operation({ id: '7', amountCents: 200_000, categoryId: 'salary' }),
        operation({ id: '8', amountCents: -900 }),
        operation({ id: '9', amountCents: 300 }),
        operation({
          id: '10',
          date: '2026-10-31',
          amountCents: -7_000,
          categoryId: 'leisure',
        }),
        ...transfer('save', 'current', 'livret-a', 10_000),
      ],
    })

    expect(breakdown).toEqual({
      needs: {
        totalCents: 64_500,
        categories: [
          { categoryId: 'housing', totalCents: 60_000 },
          { categoryId: 'groceries', totalCents: 4_500 },
        ],
      },
      wants: {
        totalCents: 2_500,
        categories: [{ categoryId: 'restaurants', totalCents: 2_500 }],
      },
      saveCents: 10_000,
      toCategorizeCents: 900,
    })
  })

  it('orders categories of equal spending by identifier', () => {
    const breakdown = spendingBreakdown({
      from: '2026-11-01',
      to: '2026-11-30',
      categories,
      accounts,
      operations: [
        operation({ id: '1', amountCents: -100, categoryId: 'restaurants' }),
        operation({ id: '2', amountCents: -100, categoryId: 'leisure' }),
      ],
    })

    expect(breakdown.wants.categories.map((item) => item.categoryId)).toEqual([
      'leisure',
      'restaurants',
    ])
  })

  it('rejects an unknown category or an expense category without group', () => {
    expect(() =>
      spendingBreakdown({
        from: '2026-11-01',
        to: '2026-11-30',
        categories,
        accounts,
        operations: [operation({ categoryId: 'missing' })],
      }),
    ).toThrow(RangeError)
    expect(() =>
      spendingBreakdown({
        from: '2026-11-01',
        to: '2026-11-30',
        categories: [category({ id: 'orphan', expenseGroup: null })],
        accounts,
        operations: [operation({ categoryId: 'orphan' })],
      }),
    ).toThrow(RangeError)
  })
})

describe('monthlyIncomeExpenses (DSH-03, real months)', () => {
  it('totals incomes and expenses per month, without transfers or adjustments', () => {
    expect(
      monthlyIncomeExpenses({
        fromMonth: '2026-10-01',
        toMonth: '2026-12-01',
        categories,
        operations: [
          operation({
            id: '1',
            date: '2026-11-02',
            amountCents: 200_000,
            categoryId: 'salary',
          }),
          operation({
            id: '2',
            date: '2026-11-03',
            amountCents: -4_000,
            categoryId: 'groceries',
          }),
          operation({
            id: '3',
            date: '2026-11-04',
            amountCents: 500,
            categoryId: 'drive',
          }),
          operation({ id: '4', date: '2026-11-05', amountCents: -1_000 }),
          operation({ id: '5', date: '2026-11-06', amountCents: 2_000 }),
          operation({
            id: '6',
            date: '2026-11-07',
            amountCents: -1_250,
            categoryId: 'adjustment',
          }),
          operation({
            id: '7',
            date: '2026-12-02',
            amountCents: -3_000,
            categoryId: 'leisure',
          }),
          operation({
            id: '8',
            date: '2027-01-02',
            amountCents: -3_000,
            categoryId: 'leisure',
          }),
          ...transfer('save', 'current', 'livret-a', 10_000, '2026-11-06'),
        ],
      }),
    ).toEqual([
      {
        month: '2026-10-01',
        incomeCents: 0,
        expenseCents: 0,
        balanceCents: 0,
      },
      {
        month: '2026-11-01',
        incomeCents: 202_000,
        expenseCents: 4_500,
        balanceCents: 197_500,
      },
      {
        month: '2026-12-01',
        incomeCents: 0,
        expenseCents: 3_000,
        balanceCents: -3_000,
      },
    ])
  })
})
