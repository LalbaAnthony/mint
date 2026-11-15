import type { Rule, RuleSuggestion } from '@mint/shared/types/rules'

export type RuleActionKind = 'category' | 'transfer'

export type RuleFormState = {
  matchType: Rule['matchType']
  pattern: string
  accountId: string
  sign: Rule['sign']
  amountMin: string
  amountMax: string
  action: RuleActionKind
  categoryId: string | undefined
  transferAccountId: string | undefined
  active: boolean
}

export interface RuleFormModalProps {
  rule: Rule | null
  draft: RuleSuggestion | null
}

export type RuleFormModalEmits = {
  saved: [rule: Rule]
}
