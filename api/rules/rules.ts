import type { Transaction } from 'sequelize'
import { RE2JS } from 're2js'
import { rulePatternFromBankLabel } from '@mint/shared/engines/labels'
import type {
  CreateRuleRequest,
  RegexMatcher,
  Rule,
  RuleInput,
  RuleSuggestion,
} from '@mint/shared/types/rules'
import { findUserAccount } from '../accounts/accounts.js'
import { findUserCategory } from '../categories/categories.js'
import { conflict, notFound, validationFailed } from '../http/http-error.js'
import { ensureUserTags } from '../tags/tags.js'
import type {
  CategorizationRuleModel,
  TransactionModel,
} from '../types/models.js'
import type { DataAccess } from '../types/planning.js'

export function toRule(rule: CategorizationRuleModel): Rule {
  return {
    id: rule.id,
    priority: rule.priority,
    matchType: rule.matchType,
    pattern: rule.pattern,
    accountId: rule.accountId,
    sign: rule.sign,
    amountMinCents: rule.amountMinCents,
    amountMaxCents: rule.amountMaxCents,
    categoryId: rule.actionCategoryId,
    transferAccountId: rule.actionTransferAccountId,
    tagIds: rule.actionTagIds,
    active: rule.active,
  }
}

export function ruleColumns(fields: CreateRuleRequest) {
  return {
    matchType: fields.matchType,
    pattern: fields.pattern,
    accountId: fields.accountId,
    sign: fields.sign,
    amountMinCents: fields.amountMinCents,
    amountMaxCents: fields.amountMaxCents,
    actionCategoryId: fields.categoryId,
    actionTransferAccountId: fields.transferAccountId,
    actionTagIds: fields.tagIds,
    active: fields.active,
  }
}

export function ruleFieldsOf(rule: CategorizationRuleModel): CreateRuleRequest {
  const view = toRule(rule)
  return {
    matchType: view.matchType,
    pattern: view.pattern,
    accountId: view.accountId,
    sign: view.sign,
    amountMinCents: view.amountMinCents,
    amountMaxCents: view.amountMaxCents,
    categoryId: view.categoryId,
    transferAccountId: view.transferAccountId,
    tagIds: view.tagIds,
    active: view.active,
  }
}

export function createRegexMatcher(): RegexMatcher {
  const compiled = new Map<string, RE2JS>()
  return (pattern, text) => {
    let expression = compiled.get(pattern)
    if (expression === undefined) {
      expression = RE2JS.compile(pattern, RE2JS.CASE_INSENSITIVE)
      compiled.set(pattern, expression)
    }
    return expression.test(text)
  }
}

export function ensureValidPattern(fields: CreateRuleRequest): void {
  if (fields.matchType !== 'regex') {
    return
  }
  try {
    RE2JS.compile(fields.pattern, RE2JS.CASE_INSENSITIVE)
  } catch {
    throw validationFailed([{ path: ['pattern'], message: 'invalid_regex' }])
  }
}

export async function findUserRule(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<CategorizationRuleModel> {
  const rule = await data.models.CategorizationRule.findOne({
    where: { id, userId },
    transaction,
  })
  if (rule === null) {
    throw notFound()
  }
  return rule
}

export async function validateRuleReferences(
  data: DataAccess,
  userId: string,
  fields: CreateRuleRequest,
  previous: CreateRuleRequest | null,
  transaction?: Transaction,
): Promise<void> {
  ensureValidPattern(fields)
  await ensureUserTags(data, userId, fields.tagIds, transaction)
  if (fields.accountId !== null) {
    const account = await findUserAccount(
      data,
      userId,
      fields.accountId,
      transaction,
    )
    if (previous?.accountId !== account.id && account.archivedAt !== null) {
      throw conflict('account_archived')
    }
  }
  if (fields.transferAccountId !== null) {
    const target = await findUserAccount(
      data,
      userId,
      fields.transferAccountId,
      transaction,
    )
    if (
      previous?.transferAccountId !== target.id &&
      target.archivedAt !== null
    ) {
      throw conflict('account_archived')
    }
    if (fields.accountId === target.id) {
      throw validationFailed([
        { path: ['transferAccountId'], message: 'same_account' },
      ])
    }
  }
  if (fields.categoryId !== null) {
    const category = await findUserCategory(
      data,
      userId,
      fields.categoryId,
      transaction,
    )
    if (category.kind === 'adjustment') {
      throw validationFailed([
        { path: ['categoryId'], message: 'adjustment_not_allowed' },
      ])
    }
    if (previous?.categoryId !== category.id && category.archivedAt !== null) {
      throw conflict('category_archived')
    }
  }
}

export async function nextRulePriority(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<number> {
  const highest: unknown = await data.models.CategorizationRule.max(
    'priority',
    { where: { userId }, transaction },
  )
  return typeof highest === 'number' ? highest + 1 : 0
}

export async function loadRuleInputs(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<RuleInput[]> {
  const rules = await data.models.CategorizationRule.findAll({
    where: { userId, active: true },
    order: [
      ['priority', 'ASC'],
      ['createdAt', 'ASC'],
    ],
    transaction,
  })
  return rules.map(toRule)
}

export function suggestRule(
  operation: TransactionModel,
  tagIds: string[],
): RuleSuggestion {
  if (operation.bankLabel === null) {
    throw conflict('operation_without_bank_label')
  }
  return {
    matchType: 'contains',
    pattern: rulePatternFromBankLabel(operation.bankLabel),
    accountId: null,
    sign: operation.amountCents < 0 ? 'debit' : 'credit',
    categoryId:
      operation.transferGroupId === null ? operation.categoryId : null,
    transferAccountId: null,
    tagIds,
  }
}
