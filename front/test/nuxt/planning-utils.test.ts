import { describe, expect, it } from 'vitest'
import {
  account,
  card,
  categories,
  category,
  ids,
  livret,
  operation,
} from '../planning-fixtures'

describe('payment sources (PAY-04)', () => {
  it('offers each active account and its active payment methods', () => {
    const archivedCard = {
      ...card,
      id: '00000000-0000-4000-8000-0000000000b2',
      label: 'Ancienne',
      archivedAt: '2026-10-01T00:00:00.000Z',
    }

    expect(
      paymentSourceItems([account(), livret], [card, archivedCard], undefined),
    ).toEqual([
      { label: 'Compte courant', value: `account:${ids.current}` },
      { label: 'Carte CA (Compte courant)', value: `method:${ids.card}` },
      { label: 'Livret A', value: `account:${ids.livret}` },
    ])
    expect(
      paymentSourceItems(
        [account()],
        [archivedCard],
        `method:${archivedCard.id}`,
      ),
    ).toContainEqual({
      label: 'Ancienne (Compte courant)',
      value: `method:${archivedCard.id}`,
    })
  })

  it('converts between a source value and its account or payment method', () => {
    expect(paymentSourceValue(ids.current, null)).toBe(`account:${ids.current}`)
    expect(paymentSourceValue(ids.current, ids.card)).toBe(`method:${ids.card}`)
    expect(paymentSourceValue(null, null)).toBeUndefined()
    expect(toPaymentSource(`method:${ids.card}`)).toEqual({
      accountId: null,
      paymentMethodId: ids.card,
    })
    expect(sourceAccountId(`method:${ids.card}`, [card])).toBe(ids.current)
    expect(sourceAccountId(`account:${ids.livret}`, [card])).toBe(ids.livret)
  })
})

describe('category options', () => {
  it('lists active categories of the requested kinds with their subcategories, without the adjustment one', () => {
    const drive = category({
      id: '00000000-0000-4000-8000-0000000000c9',
      parentId: ids.groceries,
      expenseGroup: null,
      name: 'Drive',
    })
    const groups = categoryOptionGroups(
      [
        ...categories,
        drive,
        category({
          id: '00000000-0000-4000-8000-0000000000ca',
          kind: 'adjustment',
          expenseGroup: null,
          name: 'Ajustement',
          isSystem: true,
        }),
      ],
      ['income', 'expense'],
      undefined,
      (kind) => kind,
    )

    expect(groups.map((group) => group.kind)).toEqual(['income', 'expense'])
    expect(groups[1]?.options.map((option) => option.label)).toEqual([
      'Courses',
      'Courses › Drive',
      'Alimentation',
      'Loisirs',
    ])
  })
})

describe('operation query (OPE-05)', () => {
  it('serializes filters with absolute amounts in cents and repeated lists', () => {
    const filters = {
      ...emptyOperationFilters(),
      q: '  loyer ',
      from: '2026-11-01',
      accountIds: [ids.current, ids.livret],
      groups: ['save' as const],
      minAmount: '-12,50',
      maxAmount: '100',
      direction: 'debit' as const,
      origins: ['schedule' as const],
      status: 'to_categorize' as const,
    }

    expect(
      operationQuery(filters, { sort: 'amount', order: 'asc' }, 2, 25, 'fr'),
    ).toBe(
      `page=2&pageSize=25&sort=amount&order=asc&q=loyer&from=2026-11-01&accountIds=${ids.current}&accountIds=${ids.livret}&groups=save&minCents=1250&maxCents=10000&direction=debit&origins=schedule&status=to_categorize`,
    )
    expect(activeFilterCount(filters)).toBe(8)
    expect(activeFilterCount(emptyOperationFilters())).toBe(0)
  })

  it('maps origins to their icon (CHG-61)', () => {
    expect(originIcon(operation())).toBe(icons.manualOrigin)
    expect(originIcon(operation({ origin: 'import' }))).toBe(icons.import)
    expect(originIcon(operation({ origin: 'schedule' }))).toBe(icons.schedules)
  })
})
