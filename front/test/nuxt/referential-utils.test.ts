import { describe, expect, it } from 'vitest'
import type { Category } from '@mint/shared/types/categories'
import { applyCategoryOrder, buildCategorySections } from '~/utils/categories'
import { parisDate } from '~/utils/dates'
import { formatAmountInput, parseAmountInput } from '~/utils/money'
import { moveItem } from '~/utils/ordering'

function category(overrides: Partial<Category>): Category {
  return {
    id: 'id',
    parentId: null,
    kind: 'expense',
    expenseGroup: 'needs',
    name: 'Catégorie',
    isSystem: false,
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
  }
}

describe('parseAmountInput (OPE-08)', () => {
  it.each([
    ['2000', 200_000],
    ['2 000,50', 200_050],
    ['1 234,5', 123_450],
    ['-12,50', -1_250],
    ['−12.5', -1_250],
    ['+0,07', 7],
    ['0', 0],
  ])('reads %s as %i cents', (text, cents) => {
    expect(parseAmountInput(text)).toBe(cents)
  })

  it.each(['', 'abc', '12,345', '1,234.56', '12.', '--3'])(
    'refuses %j',
    (text) => {
      expect(parseAmountInput(text)).toBeNull()
    },
  )

  it('round-trips the input format of each locale', () => {
    expect(parseAmountInput(formatAmountInput(-123_456, 'fr'))).toBe(-123_456)
    expect(parseAmountInput(formatAmountInput(123_456, 'en'))).toBe(123_456)
    expect(formatAmountInput(200_000, 'fr')).toBe('2000,00')
  })
})

describe('moveItem', () => {
  it('moves an item to another position', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 0)).toEqual(['c', 'a', 'b'])
  })

  it('keeps the order for an out of range move', () => {
    expect(moveItem(['a', 'b'], 0, 2)).toEqual(['a', 'b'])
    expect(moveItem(['a', 'b'], 1, -1)).toEqual(['a', 'b'])
  })
})

describe('parisDate', () => {
  it('reads the calendar date in Europe/Paris', () => {
    expect(parisDate(new Date('2026-11-11T23:30:00Z'))).toBe('2026-11-12')
  })
})

describe('buildCategorySections', () => {
  it('splits Needs, Wants, income and system categories, subcategories under their parent', () => {
    const sections = buildCategorySections([
      category({ id: 'leisure', expenseGroup: 'wants', sortOrder: 1 }),
      category({ id: 'housing', sortOrder: 1 }),
      category({ id: 'groceries', sortOrder: 0 }),
      category({
        id: 'rent',
        parentId: 'housing',
        expenseGroup: 'needs',
        sortOrder: 0,
      }),
      category({ id: 'salary', kind: 'income', expenseGroup: null }),
      category({
        id: 'interest',
        kind: 'income',
        expenseGroup: null,
        isSystem: true,
      }),
      category({
        id: 'adjustment',
        kind: 'adjustment',
        expenseGroup: null,
        isSystem: true,
        sortOrder: 1,
      }),
    ])

    expect(
      sections.map((section) => [
        section.id,
        section.nodes.map((node) => [
          node.category.id,
          node.children.map((child) => child.category.id),
        ]),
      ]),
    ).toEqual([
      [
        'needs',
        [
          ['groceries', []],
          ['housing', ['rent']],
        ],
      ],
      ['wants', [['leisure', []]]],
      ['income', [['salary', []]]],
      [
        'system',
        [
          ['interest', []],
          ['adjustment', []],
        ],
      ],
    ])
  })

  it('applies a new order to the listed categories only', () => {
    const ordered = applyCategoryOrder(
      [
        category({ id: 'a', sortOrder: 0 }),
        category({ id: 'b', sortOrder: 1 }),
        category({ id: 'c', sortOrder: 5 }),
      ],
      ['b', 'a'],
    )

    expect(ordered.map((item) => [item.id, item.sortOrder])).toEqual([
      ['a', 1],
      ['b', 0],
      ['c', 5],
    ])
  })
})
