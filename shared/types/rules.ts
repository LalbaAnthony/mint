import type { z } from 'zod'
import type {
  applyRulesRequestSchema,
  applyRulesResponseSchema,
  createRuleRequestSchema,
  reappliedClassificationSchema,
  reapplyRuleChangeSchema,
  reapplyRuleSkipSchema,
  reapplyRulesPreviewRequestSchema,
  reapplyRulesPreviewSchema,
  reapplySkipReasonSchema,
  reorderRulesRequestSchema,
  ruleMatchTypeSchema,
  ruleSchema,
  ruleSignSchema,
  ruleSuggestionSchema,
  updateRuleRequestSchema,
} from '../schemas/rules.js'

export type RuleMatchType = z.infer<typeof ruleMatchTypeSchema>

export type RuleSign = z.infer<typeof ruleSignSchema>

export type CreateRuleRequest = z.infer<typeof createRuleRequestSchema>

export type UpdateRuleRequest = z.infer<typeof updateRuleRequestSchema>

export type Rule = z.infer<typeof ruleSchema>

export type ReorderRulesRequest = z.infer<typeof reorderRulesRequestSchema>

export type RuleSuggestion = z.infer<typeof ruleSuggestionSchema>

export type RuleInput = Pick<
  Rule,
  | 'id'
  | 'matchType'
  | 'pattern'
  | 'accountId'
  | 'sign'
  | 'amountMinCents'
  | 'amountMaxCents'
  | 'categoryId'
  | 'transferAccountId'
  | 'tagIds'
  | 'active'
>

export type RuleSubject = {
  accountId: string
  amountCents: number
  label: string
}

export type RegexMatcher = (pattern: string, text: string) => boolean

export type ReapplySkipReason = z.infer<typeof reapplySkipReasonSchema>

export type ReapplyRulesPreviewRequest = z.infer<
  typeof reapplyRulesPreviewRequestSchema
>

export type ReappliedClassification = z.infer<
  typeof reappliedClassificationSchema
>

export type ReapplyRuleChange = z.infer<typeof reapplyRuleChangeSchema>

export type ReapplyRuleSkip = z.infer<typeof reapplyRuleSkipSchema>

export type ReapplyRulesPreview = z.infer<typeof reapplyRulesPreviewSchema>

export type ApplyRulesRequest = z.infer<typeof applyRulesRequestSchema>

export type ApplyRulesResponse = z.infer<typeof applyRulesResponseSchema>
