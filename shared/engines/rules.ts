import type { RegexMatcher, RuleInput, RuleSubject } from '../types/rules.js'
import { foldForMatching, stripAccents } from './labels.js'

function matchesLabel(
  rule: RuleInput,
  label: string,
  matchesRegex: RegexMatcher,
): boolean {
  if (rule.matchType === 'regex') {
    return matchesRegex(stripAccents(rule.pattern), stripAccents(label))
  }
  const folded = foldForMatching(label)
  const pattern = foldForMatching(rule.pattern)
  return rule.matchType === 'contains'
    ? folded.includes(pattern)
    : folded.startsWith(pattern)
}

export function ruleMatches(
  rule: RuleInput,
  subject: RuleSubject,
  matchesRegex: RegexMatcher,
): boolean {
  if (!rule.active) {
    return false
  }
  if (rule.accountId !== null && rule.accountId !== subject.accountId) {
    return false
  }
  if (rule.sign === 'debit' && subject.amountCents >= 0) {
    return false
  }
  if (rule.sign === 'credit' && subject.amountCents <= 0) {
    return false
  }
  const magnitude = Math.abs(subject.amountCents)
  if (rule.amountMinCents !== null && magnitude < rule.amountMinCents) {
    return false
  }
  if (rule.amountMaxCents !== null && magnitude > rule.amountMaxCents) {
    return false
  }
  return matchesLabel(rule, subject.label, matchesRegex)
}

export function firstMatchingRule(
  rules: readonly RuleInput[],
  subject: RuleSubject,
  matchesRegex: RegexMatcher,
): RuleInput | null {
  return rules.find((rule) => ruleMatches(rule, subject, matchesRegex)) ?? null
}
