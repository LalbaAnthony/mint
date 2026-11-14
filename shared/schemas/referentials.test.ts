import { describe, expect, it } from 'vitest'
import {
  createAccountRequestSchema,
  productsForNature,
  regulatedProductIssue,
} from './accounts.js'
import { createCategoryRequestSchema, expenseGroupIssue } from './categories.js'
import { amountCentsSchema, labelSchema, maxAmountCents } from './common.js'

describe('account rules (CPT-01, CPT-02)', () => {
  it('offers Livret A, LDDS and LEP for regulated savings, PEL and CEL for home savings', () => {
    expect(productsForNature('regulated_savings')).toEqual([
      'livret_a',
      'ldds',
      'lep',
    ])
    expect(productsForNature('housing_savings')).toEqual(['pel', 'cel'])
    expect(productsForNature('life_insurance')).toEqual([])
  })

  it.each([
    ['regulated_savings', 'lep', null],
    ['regulated_savings', null, 'product_required'],
    ['housing_savings', 'livret_a', 'product_mismatch'],
    ['current_account', null, null],
    ['crypto_wallet', 'pel', 'product_mismatch'],
  ] as const)('%s with %s gives %s', (nature, regulatedProduct, issue) => {
    expect(regulatedProductIssue({ nature, regulatedProduct })).toBe(issue)
  })

  it('reports the product issue on the regulatedProduct field', () => {
    const result = createAccountRequestSchema.safeParse({
      name: 'Livret',
      nature: 'regulated_savings',
      regulatedProduct: null,
      usage: 'savings',
      institution: null,
      initialBalanceCents: 0,
      initialBalanceDate: '2026-11-11',
      lowBalanceThresholdCents: null,
    })

    expect(
      result.error?.issues.map((issue) => [issue.path, issue.message]),
    ).toEqual([[['regulatedProduct'], 'product_required']])
  })

  it('accepts signed amounts in cents up to 999 999 999,99 EUR (OPE-08)', () => {
    expect(amountCentsSchema.safeParse(-maxAmountCents).success).toBe(true)
    expect(amountCentsSchema.safeParse(maxAmountCents + 1).success).toBe(false)
    expect(amountCentsSchema.safeParse(10.5).error?.issues[0]?.message).toBe(
      'invalid_amount',
    )
  })

  it('trims labels and refuses blank or over-long ones', () => {
    expect(labelSchema.parse('  Livret A  ')).toBe('Livret A')
    expect(labelSchema.safeParse('   ').error?.issues[0]?.message).toBe(
      'required',
    )
    expect(
      labelSchema.safeParse('a'.repeat(101)).error?.issues[0]?.message,
    ).toBe('too_long')
  })
})

describe('category rules (CAT-02, CAT-04)', () => {
  it.each([
    ['expense', null, 'needs', null],
    ['expense', null, null, 'group_required'],
    ['expense', '00000000-0000-4000-8000-000000000001', null, null],
    [
      'expense',
      '00000000-0000-4000-8000-000000000001',
      'wants',
      'group_not_allowed',
    ],
    ['income', null, null, null],
    ['income', null, 'needs', 'group_not_allowed'],
  ] as const)(
    '%s with parent %s and group %s gives %s',
    (kind, parentId, expenseGroup, issue) => {
      expect(expenseGroupIssue({ kind, parentId, expenseGroup })).toBe(issue)
    },
  )

  it('refuses the system adjustment kind on creation', () => {
    const result = createCategoryRequestSchema.safeParse({
      kind: 'adjustment',
      name: 'Correction',
      parentId: null,
      expenseGroup: null,
    })

    expect(result.success).toBe(false)
  })
})
