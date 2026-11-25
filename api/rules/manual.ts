import { randomUUID } from 'node:crypto'
import type { Transaction } from 'sequelize'
import { firstMatchingRule } from '@mint/shared/engines/rules'
import { maxTagsPerItem } from '@mint/shared/schemas/tags'
import type { RuleInput } from '@mint/shared/types/rules'
import {
  findTransferCounterpart,
  linkOrCreateCounterpart,
  shareTagsAcross,
} from '../reconciliation/apply.js'
import { addOperationTags, tagIdsByOperation, unionOf } from '../tags/tags.js'
import type { TransactionModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import { createRegexMatcher, loadRuleInputs, ruleLabelOf } from './rules.js'

async function categorizeByRule(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  rule: RuleInput,
  categoryId: string,
  transaction: Transaction,
): Promise<void> {
  const category = await data.models.Category.findOne({
    where: { id: categoryId, userId },
    transaction,
  })
  if (category === null) {
    throw new Error(`Rule ${rule.id} classifies into an unknown category`)
  }
  if (category.archivedAt !== null) {
    return
  }
  await operation.update(
    { categoryId: category.id, status: 'categorized' },
    { transaction },
  )
}

async function convertByRule(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  targetAccountId: string,
  ruleTagIds: readonly string[],
  transaction: Transaction,
): Promise<TransactionModel | null> {
  const target = await data.models.Account.findOne({
    where: { id: targetAccountId, userId },
    transaction,
  })
  if (
    target === null ||
    target.archivedAt !== null ||
    target.id === operation.accountId
  ) {
    return null
  }
  const counterpart = await findTransferCounterpart(
    data,
    userId,
    operation,
    target.id,
    new Set(),
    transaction,
  )
  if (counterpart === null && operation.date < target.initialBalanceDate) {
    return null
  }
  const currentTagIds = await tagIdsByOperation(
    data,
    counterpart === null ? [operation.id] : [operation.id, counterpart.id],
    transaction,
  )
  if (unionOf(ruleTagIds, ...currentTagIds.values()).length > maxTagsPerItem) {
    return null
  }
  await operation.update(
    { transferGroupId: randomUUID(), categoryId: null, status: 'categorized' },
    { transaction },
  )
  const linked = await linkOrCreateCounterpart(
    data,
    userId,
    operation,
    target.id,
    null,
    transaction,
  )
  await shareTagsAcross(
    data,
    userId,
    [operation, linked],
    ruleTagIds,
    transaction,
  )
  return linked
}

export async function applyRulesToManualOperation(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  enteredTagIds: readonly string[],
  transaction: Transaction,
): Promise<TransactionModel | null> {
  const classifies = operation.categoryId === null
  const addsTags = enteredTagIds.length === 0
  if (!classifies && !addsTags) {
    return null
  }
  const rule = firstMatchingRule(
    await loadRuleInputs(data, userId, transaction),
    {
      accountId: operation.accountId,
      amountCents: operation.amountCents,
      label: ruleLabelOf(operation),
    },
    createRegexMatcher(),
  )
  if (rule === null) {
    return null
  }
  const ruleTagIds = addsTags ? rule.tagIds : []
  if (classifies) {
    if (rule.transferAccountId !== null) {
      const counterpart = await convertByRule(
        data,
        userId,
        operation,
        rule.transferAccountId,
        ruleTagIds,
        transaction,
      )
      if (counterpart !== null) {
        return counterpart
      }
    } else if (rule.categoryId !== null) {
      await categorizeByRule(
        data,
        userId,
        operation,
        rule,
        rule.categoryId,
        transaction,
      )
    } else {
      throw new Error(`Rule ${rule.id} has no classification`)
    }
  }
  await addOperationTags(data, userId, [operation.id], ruleTagIds, transaction)
  return null
}
