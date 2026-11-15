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
  maxAmountCents,
  orderedIdsSchema,
} from './common.js'
import {
  capCentsSchema,
  capitalizationSchema,
  interestMethodSchema,
  interestSummarySchema,
} from './interest.js'
import { investmentSummarySchema } from './valuations.js'

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

export const investmentNatures = [
  'life_insurance',
  'securities_account',
  'crypto_wallet',
] as const

export function isInvestmentNature(nature: AccountNature): boolean {
  return investmentNatures.some((candidate) => candidate === nature)
}

export const savingsNatures = ['regulated_savings', 'housing_savings'] as const

export function isSavingsNature(nature: AccountNature): boolean {
  return savingsNatures.some((candidate) => candidate === nature)
}

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
  depositCapCents: capCentsSchema.nullable().optional(),
  capitalizedInterestCents: z
    .number({ error: 'invalid_amount' })
    .int({ error: 'invalid_amount' })
    .min(0, { error: 'amount_out_of_range' })
    .max(maxAmountCents, { error: 'amount_out_of_range' })
    .nullable()
    .optional(),
  interestMethod: interestMethodSchema.nullable().optional(),
  capitalization: capitalizationSchema.nullable().optional(),
  anniversaryDate: isoDateSchema.nullable().optional(),
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
    if (
      account.capitalization === 'anniversary' &&
      (account.anniversaryDate ?? null) === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'required',
        path: ['anniversaryDate'],
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
    depositCapCents: z.number().int().nullable(),
    capitalizedInterestCents: z.number().int().nullable(),
    interestMethod: interestMethodSchema.nullable(),
    capitalization: capitalizationSchema.nullable(),
    anniversaryDate: z.iso.date().nullable(),
    currentBalanceCents: z.number().int(),
    reconciliationGapCents: z.number().int().nullable(),
    investment: investmentSummarySchema.nullable(),
    interest: interestSummarySchema.nullable(),
    depositCapExcessCents: z.number().int().nullable(),
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

export const regulatedCapSchema = z
  .object({ product: regulatedProductSchema, capCents: z.number().int() })
  .meta({ id: 'RegulatedCap' })

export const regulatedCapListResponseSchema = z
  .array(regulatedCapSchema)
  .meta({ id: 'RegulatedCapListResponse' })

export const updateRegulatedCapRequestSchema = z
  .object({ capCents: capCentsSchema })
  .meta({ id: 'UpdateRegulatedCapRequest' })

export const regulatedCapParamsSchema = z.object({
  product: regulatedProductSchema,
})
