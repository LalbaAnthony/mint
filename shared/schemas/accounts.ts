import { z } from 'zod'
import type {
  AccountNature,
  RegulatedProduct,
  RegulatedProductIssue,
} from '../types/accounts.js'
import {
  amountCentsSchema,
  isoDateSchema,
  labelSchema,
  orderedIdsSchema,
} from './common.js'

export const accountNatures = [
  'current_account',
  'regulated_savings',
  'housing_savings',
  'life_insurance',
  'securities_account',
  'crypto_wallet',
  'meal_vouchers',
  'e_wallet',
  'other',
] as const

export const accountUsages = [
  'current',
  'emergency',
  'savings',
  'investment',
] as const

export const regulatedProducts = [
  'livret_a',
  'ldds',
  'lep',
  'pel',
  'cel',
] as const

export const accountNatureSchema = z
  .enum(accountNatures, { error: 'invalid' })
  .meta({ id: 'AccountNature' })

export const accountUsageSchema = z
  .enum(accountUsages, { error: 'invalid' })
  .meta({ id: 'AccountUsage' })

export const regulatedProductSchema = z
  .enum(regulatedProducts, { error: 'invalid' })
  .meta({ id: 'RegulatedProduct' })

export function productsForNature(
  nature: AccountNature,
): readonly RegulatedProduct[] {
  switch (nature) {
    case 'regulated_savings':
      return ['livret_a', 'ldds', 'lep']
    case 'housing_savings':
      return ['pel', 'cel']
    default:
      return []
  }
}

export function regulatedProductIssue(account: {
  nature: AccountNature
  regulatedProduct: RegulatedProduct | null
}): RegulatedProductIssue | null {
  const allowed = productsForNature(account.nature)
  if (account.regulatedProduct === null) {
    return allowed.length === 0 ? null : 'product_required'
  }
  return allowed.includes(account.regulatedProduct) ? null : 'product_mismatch'
}

const accountFieldsSchema = z.object({
  name: labelSchema,
  nature: accountNatureSchema,
  regulatedProduct: regulatedProductSchema.nullable(),
  usage: accountUsageSchema,
  institution: labelSchema.nullable(),
  initialBalanceCents: amountCentsSchema,
  initialBalanceDate: isoDateSchema,
  lowBalanceThresholdCents: amountCentsSchema.nullable(),
})

export const createAccountRequestSchema = accountFieldsSchema
  .superRefine((account, context) => {
    const issue = regulatedProductIssue(account)
    if (issue !== null) {
      context.addIssue({
        code: 'custom',
        message: issue,
        path: ['regulatedProduct'],
      })
    }
  })
  .meta({ id: 'CreateAccountRequest' })

export const updateAccountRequestSchema = accountFieldsSchema
  .partial()
  .meta({ id: 'UpdateAccountRequest' })

export const accountSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    nature: accountNatureSchema,
    regulatedProduct: regulatedProductSchema.nullable(),
    usage: accountUsageSchema,
    institution: z.string().nullable(),
    initialBalanceCents: z.number().int(),
    initialBalanceDate: z.iso.date(),
    lowBalanceThresholdCents: z.number().int().nullable(),
    sortOrder: z.number().int(),
    archivedAt: z.iso.datetime().nullable(),
    currentBalanceCents: z.number().int(),
    reconciliationGapCents: z.number().int().nullable(),
  })
  .meta({ id: 'Account' })

export const accountUsageGroupSchema = z
  .object({
    usage: accountUsageSchema,
    subtotalCents: z.number().int(),
    accounts: z.array(accountSchema),
  })
  .meta({ id: 'AccountUsageGroup' })

export const accountOverviewSchema = z
  .object({
    totalCents: z.number().int(),
    groups: z.array(accountUsageGroupSchema),
    archived: z.array(accountSchema),
  })
  .meta({ id: 'AccountOverview' })

export const reorderAccountsRequestSchema = z
  .object({ usage: accountUsageSchema, accountIds: orderedIdsSchema })
  .meta({ id: 'ReorderAccountsRequest' })
