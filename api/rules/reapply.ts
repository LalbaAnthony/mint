import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { firstMatchingRule } from '@mint/shared/engines/rules'
import { maxTagsPerItem } from '@mint/shared/schemas/tags'
import type { Operation } from '@mint/shared/types/operations'
import type {
  ReappliedClassification,
  ReapplyRulesPreview,
  ReapplySkipReason,
  RuleInput,
} from '@mint/shared/types/rules'
import { conflict, notFound } from '../http/http-error.js'
import { toOperations } from '../operations/operations.js'
import {
  findTransferCounterpart,
  linkOrCreateCounterpart,
  shareTagsAcross,
} from '../reconciliation/apply.js'
import { addOperationTags, tagIdsByOperation, unionOf } from '../tags/tags.js'
import type { TransactionModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import type {
  ReapplyContext,
  ReapplyOutcome,
  ReapplyPlan,
} from '../types/rules.js'
import { createRegexMatcher, loadRuleInputs } from './rules.js'

function skip(reason: ReapplySkipReason): ReapplyOutcome {
  return { kind: 'skip', reason }
}

function change(after: ReappliedClassification): ReapplyOutcome {
  return { kind: 'change', after }
}

async function loadSelectedOperations(
  data: DataAccess,
  userId: string,
  operationIds: readonly string[],
  transaction?: Transaction,
): Promise<TransactionModel[]> {
  const rows = await data.models.Transaction.findAll({
    where: { userId, id: { [Op.in]: [...operationIds] } },
    transaction,
  })
  const byId = new Map(rows.map((row) => [row.id, row]))
  return operationIds.map((id) => {
    const operation = byId.get(id)
    if (operation === undefined) {
      throw notFound()
    }
    return operation
  })
}

function tagsOnlyOutcome(view: Operation, rule: RuleInput): ReapplyOutcome {
  const tagIds = unionOf(view.tagIds, rule.tagIds)
  if (tagIds.length === unionOf(view.tagIds).length) {
    return skip('unchanged')
  }
  if (tagIds.length > maxTagsPerItem) {
    return skip('too_many_tags')
  }
  return change({
    operationId: view.id,
    ruleId: rule.id,
    categoryId: view.categoryId,
    transferAccountId: view.counterpartAccountId,
    tagIds,
  })
}

async function transferOutcome(
  context: ReapplyContext,
  operation: TransactionModel,
  view: Operation,
  rule: RuleInput,
  targetAccountId: string,
): Promise<ReapplyOutcome> {
  const target = context.accounts.get(targetAccountId)
  if (target === undefined || target.archivedAt !== null) {
    return skip('account_archived')
  }
  if (target.id === operation.accountId) {
    return skip('same_account')
  }
  const counterpart = await findTransferCounterpart(
    context.data,
    context.userId,
    operation,
    target.id,
    context.claimedCounterparts,
    context.transaction,
  )
  if (counterpart === null && operation.date < target.initialBalanceDate) {
    return skip('before_initial_balance')
  }
  const counterpartTagIds =
    counterpart === null
      ? []
      : ((
          await tagIdsByOperation(
            context.data,
            [counterpart.id],
            context.transaction,
          )
        ).get(counterpart.id) ?? [])
  const tagIds = unionOf(view.tagIds, counterpartTagIds, rule.tagIds)
  if (tagIds.length > maxTagsPerItem) {
    return skip('too_many_tags')
  }
  if (counterpart !== null) {
    context.claimedCounterparts.add(counterpart.id)
  }
  return change({
    operationId: operation.id,
    ruleId: rule.id,
    categoryId: null,
    transferAccountId: target.id,
    tagIds,
  })
}

function categoryOutcome(
  context: ReapplyContext,
  view: Operation,
  rule: RuleInput,
  categoryId: string,
): ReapplyOutcome {
  const category = context.categories.get(categoryId)
  if (category === undefined) {
    throw new Error(`Rule ${rule.id} classifies into an unknown category`)
  }
  if (category.archivedAt !== null) {
    return skip('category_archived')
  }
  const tagIds = unionOf(view.tagIds, rule.tagIds)
  if (
    category.id === view.categoryId &&
    tagIds.length === unionOf(view.tagIds).length
  ) {
    return skip('unchanged')
  }
  if (tagIds.length > maxTagsPerItem) {
    return skip('too_many_tags')
  }
  return change({
    operationId: view.id,
    ruleId: rule.id,
    categoryId: category.id,
    transferAccountId: null,
    tagIds,
  })
}

async function planOperation(
  context: ReapplyContext,
  operation: TransactionModel,
  view: Operation,
): Promise<ReapplyOutcome> {
  if (operation.bankLabel === null) {
    return skip('no_bank_label')
  }
  const currentCategory =
    operation.categoryId === null
      ? undefined
      : context.categories.get(operation.categoryId)
  if (currentCategory?.kind === 'adjustment') {
    return skip('adjustment')
  }
  const rule = firstMatchingRule(
    context.rules,
    {
      accountId: operation.accountId,
      amountCents: operation.amountCents,
      bankLabel: operation.bankLabel,
    },
    context.matcher,
  )
  if (rule === null) {
    return skip('no_matching_rule')
  }
  if (operation.transferGroupId !== null || operation.occurrenceId !== null) {
    return tagsOnlyOutcome(view, rule)
  }
  if (rule.transferAccountId !== null) {
    return transferOutcome(
      context,
      operation,
      view,
      rule,
      rule.transferAccountId,
    )
  }
  if (rule.categoryId !== null) {
    return categoryOutcome(context, view, rule, rule.categoryId)
  }
  throw new Error(`Rule ${rule.id} has no classification`)
}

export async function planReapplication(
  data: DataAccess,
  userId: string,
  operationIds: readonly string[],
  transaction?: Transaction,
): Promise<ReapplyPlan[]> {
  const operations = await loadSelectedOperations(
    data,
    userId,
    operationIds,
    transaction,
  )
  const views = await toOperations(data, operations, transaction)
  const context: ReapplyContext = {
    data,
    userId,
    rules: await loadRuleInputs(data, userId, transaction),
    matcher: createRegexMatcher(),
    categories: new Map(
      (
        await data.models.Category.findAll({ where: { userId }, transaction })
      ).map((category) => [category.id, category]),
    ),
    accounts: new Map(
      (
        await data.models.Account.findAll({ where: { userId }, transaction })
      ).map((account) => [account.id, account]),
    ),
    claimedCounterparts: new Set(),
    transaction,
  }
  const plans: ReapplyPlan[] = []
  for (const [index, operation] of operations.entries()) {
    const view = views[index]
    if (view === undefined) {
      throw new Error(`No view for operation ${operation.id}`)
    }
    plans.push({
      operation,
      view,
      outcome: await planOperation(context, operation, view),
    })
  }
  return plans
}

export function toReapplyPreview(
  plans: readonly ReapplyPlan[],
): ReapplyRulesPreview {
  return {
    changes: plans.flatMap(({ view, outcome }) =>
      outcome.kind === 'change'
        ? [{ operation: view, after: outcome.after }]
        : [],
    ),
    skipped: plans.flatMap(({ operation, outcome }) =>
      outcome.kind === 'skip'
        ? [{ operationId: operation.id, reason: outcome.reason }]
        : [],
    ),
  }
}

function sameClassification(
  planned: ReappliedClassification,
  expected: ReappliedClassification,
): boolean {
  const expectedTagIds = unionOf(expected.tagIds)
  return (
    planned.ruleId === expected.ruleId &&
    planned.categoryId === expected.categoryId &&
    planned.transferAccountId === expected.transferAccountId &&
    planned.tagIds.length === expectedTagIds.length &&
    planned.tagIds.every((tagId, index) => tagId === expectedTagIds[index])
  )
}

async function applyPlan(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  after: ReappliedClassification,
  transaction: Transaction,
): Promise<void> {
  if (operation.transferGroupId !== null) {
    const movements = await data.models.Transaction.findAll({
      where: { userId, transferGroupId: operation.transferGroupId },
      transaction,
    })
    await addOperationTags(
      data,
      userId,
      movements.map((movement) => movement.id),
      after.tagIds,
      transaction,
    )
    return
  }
  if (operation.occurrenceId !== null) {
    await addOperationTags(
      data,
      userId,
      [operation.id],
      after.tagIds,
      transaction,
    )
    return
  }
  if (after.transferAccountId !== null) {
    await operation.update(
      {
        transferGroupId: randomUUID(),
        categoryId: null,
        status: 'categorized',
      },
      { transaction },
    )
    const counterpart = await linkOrCreateCounterpart(
      data,
      userId,
      operation,
      after.transferAccountId,
      null,
      transaction,
    )
    await shareTagsAcross(
      data,
      userId,
      [operation, counterpart],
      after.tagIds,
      transaction,
    )
    return
  }
  await operation.update(
    { categoryId: after.categoryId, status: 'categorized' },
    { transaction },
  )
  await addOperationTags(
    data,
    userId,
    [operation.id],
    after.tagIds,
    transaction,
  )
}

export async function applyReapplication(
  data: DataAccess,
  userId: string,
  expected: readonly ReappliedClassification[],
): Promise<number> {
  return data.sequelize.transaction(async (transaction) => {
    const plans = await planReapplication(
      data,
      userId,
      expected.map((change) => change.operationId),
      transaction,
    )
    for (const [index, plan] of plans.entries()) {
      const wanted = expected[index]
      if (
        wanted === undefined ||
        plan.outcome.kind !== 'change' ||
        !sameClassification(plan.outcome.after, wanted)
      ) {
        throw conflict('preview_outdated')
      }
    }
    for (const plan of plans) {
      if (plan.outcome.kind === 'change') {
        await applyPlan(
          data,
          userId,
          plan.operation,
          plan.outcome.after,
          transaction,
        )
      }
    }
    return plans.length
  })
}
