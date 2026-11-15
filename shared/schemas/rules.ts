import { z } from 'zod'
import { maxAmountCents, orderedIdsSchema } from './common.js'

export const ruleMatchTypes = ['contains', 'starts_with', 'regex'] as const

export const ruleSigns = ['debit', 'credit', 'any'] as const

export const rulePatternMaxLength = 200

const optionalIdSchema = z.uuid({ error: 'invalid' }).nullable()

const boundSchema = z
  .number({ error: 'invalid_amount' })
  .int({ error: 'invalid_amount' })
  .min(0, { error: 'amount_out_of_range' })
  .max(maxAmountCents, { error: 'amount_out_of_range' })
  .nullable()

export const ruleMatchTypeSchema = z
  .enum(ruleMatchTypes, { error: 'invalid' })
  .meta({ id: 'RuleMatchType' })

export const ruleSignSchema = z
  .enum(ruleSigns, { error: 'invalid' })
  .meta({ id: 'RuleSign' })

export const ruleFieldsSchema = z.object({
  matchType: ruleMatchTypeSchema,
  pattern: z
    .string({ error: 'required' })
    .trim()
    .min(1, { error: 'required' })
    .max(rulePatternMaxLength, { error: 'too_long' }),
  accountId: optionalIdSchema,
  sign: ruleSignSchema,
  amountMinCents: boundSchema,
  amountMaxCents: boundSchema,
  categoryId: optionalIdSchema,
  transferAccountId: optionalIdSchema,
  active: z.boolean({ error: 'invalid' }),
})

export const createRuleRequestSchema = ruleFieldsSchema
  .refine(
    (rule) => (rule.categoryId === null) !== (rule.transferAccountId === null),
    { error: 'single_action', path: ['categoryId'] },
  )
  .refine(
    (rule) =>
      rule.amountMinCents === null ||
      rule.amountMaxCents === null ||
      rule.amountMinCents <= rule.amountMaxCents,
    { error: 'range_inverted', path: ['amountMaxCents'] },
  )
  .meta({ id: 'CreateRuleRequest' })

export const updateRuleRequestSchema = ruleFieldsSchema
  .partial()
  .meta({ id: 'UpdateRuleRequest' })

export const ruleSchema = z
  .object({
    id: z.uuid(),
    priority: z.number().int(),
    matchType: ruleMatchTypeSchema,
    pattern: z.string(),
    accountId: z.uuid().nullable(),
    sign: ruleSignSchema,
    amountMinCents: z.number().int().nullable(),
    amountMaxCents: z.number().int().nullable(),
    categoryId: z.uuid().nullable(),
    transferAccountId: z.uuid().nullable(),
    active: z.boolean(),
  })
  .meta({ id: 'Rule' })

export const ruleListResponseSchema = z
  .array(ruleSchema)
  .meta({ id: 'RuleListResponse' })

export const reorderRulesRequestSchema = z
  .object({ ruleIds: orderedIdsSchema })
  .meta({ id: 'ReorderRulesRequest' })

export const ruleSuggestionQuerySchema = z
  .object({ operationId: z.uuid({ error: 'invalid' }) })
  .meta({ id: 'RuleSuggestionQuery' })

export const ruleSuggestionSchema = z
  .object({
    matchType: ruleMatchTypeSchema,
    pattern: z.string(),
    accountId: z.uuid().nullable(),
    sign: ruleSignSchema,
    categoryId: z.uuid().nullable(),
    transferAccountId: z.uuid().nullable(),
  })
  .meta({ id: 'RuleSuggestion' })
