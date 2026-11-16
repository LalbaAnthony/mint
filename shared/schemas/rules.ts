import { z } from 'zod'
import { maxAmountCents, orderedIdsSchema } from './common.js'
import { operationSchema } from './operations.js'
import { tagIdsSchema } from './tags.js'

export const ruleMatchTypes = ['contains', 'starts_with', 'regex'] as const

export const ruleSigns = ['debit', 'credit', 'any'] as const

export const rulePatternMaxLength = 200

export const maxReappliedOperations = 50

export const reapplySkipReasons = [
  'no_bank_label',
  'no_matching_rule',
  'unchanged',
  'too_many_tags',
  'adjustment',
  'category_archived',
  'account_archived',
  'same_account',
  'before_initial_balance',
] as const

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
  tagIds: tagIdsSchema.default([]),
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
  .extend({ tagIds: tagIdsSchema })
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
    tagIds: z.array(z.uuid()),
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
    tagIds: z.array(z.uuid()),
  })
  .meta({ id: 'RuleSuggestion' })

export const reapplySkipReasonSchema = z
  .enum(reapplySkipReasons)
  .meta({ id: 'ReapplySkipReason' })

export const reapplyRulesPreviewRequestSchema = z
  .object({
    operationIds: z
      .array(z.uuid({ error: 'invalid' }), { error: 'required' })
      .min(1, { error: 'required' })
      .max(maxReappliedOperations, { error: 'too_long' })
      .refine((ids) => new Set(ids).size === ids.length, {
        error: 'duplicate',
      }),
  })
  .meta({ id: 'ReapplyRulesPreviewRequest' })

export const reappliedClassificationSchema = z
  .object({
    operationId: z.uuid({ error: 'invalid' }),
    ruleId: z.uuid({ error: 'invalid' }),
    categoryId: optionalIdSchema,
    transferAccountId: optionalIdSchema,
    tagIds: z.array(z.uuid({ error: 'invalid' }), { error: 'invalid' }),
  })
  .meta({ id: 'ReappliedClassification' })

export const reapplyRuleChangeSchema = z
  .object({
    operation: operationSchema,
    after: reappliedClassificationSchema,
  })
  .meta({ id: 'ReapplyRuleChange' })

export const reapplyRuleSkipSchema = z
  .object({
    operationId: z.uuid(),
    reason: reapplySkipReasonSchema,
  })
  .meta({ id: 'ReapplyRuleSkip' })

export const reapplyRulesPreviewSchema = z
  .object({
    changes: z.array(reapplyRuleChangeSchema),
    skipped: z.array(reapplyRuleSkipSchema),
  })
  .meta({ id: 'ReapplyRulesPreview' })

export const applyRulesRequestSchema = z
  .object({
    changes: z
      .array(reappliedClassificationSchema, { error: 'required' })
      .min(1, { error: 'required' })
      .max(maxReappliedOperations, { error: 'too_long' })
      .refine(
        (changes) =>
          new Set(changes.map((change) => change.operationId)).size ===
          changes.length,
        { error: 'duplicate' },
      ),
  })
  .meta({ id: 'ApplyRulesRequest' })

export const applyRulesResponseSchema = z
  .object({ updated: z.number().int() })
  .meta({ id: 'ApplyRulesResponse' })
