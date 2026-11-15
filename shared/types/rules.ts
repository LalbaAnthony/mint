import type { z } from 'zod'
import type {
  createRuleRequestSchema,
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
  | 'active'
>

export type RuleSubject = {
  accountId: string
  amountCents: number
  bankLabel: string
}

export type RegexMatcher = (pattern: string, text: string) => boolean
