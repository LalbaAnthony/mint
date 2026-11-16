import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { addDays, daysBetween } from '@mint/shared/engines/dates'
import { resolveOccurrence } from '@mint/shared/engines/recurrence'
import { findUserAccount } from '../accounts/accounts.js'
import { conflict } from '../http/http-error.js'
import { syncExecutedOccurrence } from '../operations/operations.js'
import { loadScheduleInputs } from '../planning/inputs.js'
import { operationSnapshotSchema } from '../schemas/imports.js'
import {
  addOperationTags,
  replaceOperationTags,
  tagIdsByOperation,
  tagIdsBySchedule,
  unionOf,
} from '../tags/tags.js'
import type { BankLine } from '../types/imports.js'
import type { TransactionModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import type {
  OccurrenceTarget,
  OperationSnapshot,
} from '../types/reconciliation.js'
import {
  executedRow,
  findSchedule,
  learnBankLabel,
  markExecuted,
  requireCandidate,
} from './occurrences.js'

const transferPairingDays = 3

export async function shareTagsAcross(
  data: DataAccess,
  userId: string,
  operations: readonly TransactionModel[],
  extraTagIds: readonly string[],
  transaction: Transaction,
): Promise<void> {
  const current = await tagIdsByOperation(
    data,
    operations.map((operation) => operation.id),
    transaction,
  )
  await addOperationTags(
    data,
    userId,
    operations.map((operation) => operation.id),
    unionOf(extraTagIds, ...current.values()),
    transaction,
  )
}

export function snapshotOf(
  operation: TransactionModel,
  tagIds: string[],
): OperationSnapshot {
  return {
    date: operation.date,
    amountCents: operation.amountCents,
    label: operation.label,
    bankLabel: operation.bankLabel,
    origin: operation.origin,
    importBatchId: operation.importBatchId,
    dedupHash: operation.dedupHash,
    categoryId: operation.categoryId,
    status: operation.status,
    transferGroupId: operation.transferGroupId,
    tagIds,
  }
}

async function snapshotWithTags(
  data: DataAccess,
  operation: TransactionModel,
  transaction: Transaction,
): Promise<OperationSnapshot> {
  const tagIds = await tagIdsByOperation(data, [operation.id], transaction)
  return snapshotOf(operation, tagIds.get(operation.id) ?? [])
}

export async function restoreSnapshot(
  data: DataAccess,
  operation: TransactionModel,
  transaction: Transaction,
): Promise<void> {
  const { tagIds, ...columns } = operationSnapshotSchema.parse(
    operation.preMergeSnapshot,
  )
  await operation.update(
    { ...columns, preMergeSnapshot: null },
    { transaction },
  )
  if (tagIds !== undefined) {
    await replaceOperationTags(
      data,
      operation.userId,
      [operation.id],
      tagIds,
      transaction,
    )
  }
  await syncExecutedOccurrence(data, operation, transaction)
}

export async function reconcileBankLine(
  data: DataAccess,
  userId: string,
  line: BankLine,
  target: OccurrenceTarget,
  batchId: string,
  categoryId: string | null,
  lineTagIds: readonly string[],
  transaction: Transaction,
): Promise<'merged' | 'created'> {
  const occurrence = await requireCandidate(
    data,
    userId,
    line,
    target,
    transaction,
  )
  const schedule = await findSchedule(
    data,
    userId,
    target.scheduleId,
    transaction,
  )
  await learnBankLabel(schedule, line.bankLabel, transaction)
  if (occurrence.operationId !== null) {
    const linked = await data.models.Transaction.findOne({
      where: { id: occurrence.operationId, userId },
      transaction,
    })
    if (linked === null) {
      throw conflict('occurrence_not_candidate')
    }
    await linked.update(
      {
        preMergeSnapshot: await snapshotWithTags(data, linked, transaction),
        date: line.date,
        amountCents: line.amountCents,
        bankLabel: line.bankLabel,
        dedupHash: line.dedupHash,
        origin: 'import',
        importBatchId: batchId,
      },
      { transaction },
    )
    await addOperationTags(data, userId, [linked.id], lineTagIds, transaction)
    await syncExecutedOccurrence(data, linked, transaction)
    return 'merged'
  }
  const scheduleTagIds =
    (await tagIdsBySchedule(data, [schedule.id], transaction)).get(
      schedule.id,
    ) ?? []
  const createdTagIds = unionOf(scheduleTagIds, lineTagIds)
  const row = await markExecuted(
    data,
    target,
    line.date,
    line.amountCents,
    transaction,
  )
  const common = {
    userId,
    date: line.date,
    label: schedule.label,
    importBatchId: batchId,
    occurrenceId: row.id,
  }
  if (schedule.kind === 'transfer') {
    const transferGroupId = randomUUID()
    const counterpartAccountId =
      schedule.sourceAccountId === line.accountId
        ? schedule.targetAccountId
        : schedule.sourceAccountId
    if (counterpartAccountId === null) {
      throw conflict('occurrence_not_candidate')
    }
    const movements = await data.models.Transaction.bulkCreate(
      [
        {
          ...common,
          accountId: line.accountId,
          amountCents: line.amountCents,
          bankLabel: line.bankLabel,
          dedupHash: line.dedupHash,
          status: 'categorized',
          origin: 'import',
          transferGroupId,
        },
        {
          ...common,
          accountId: counterpartAccountId,
          amountCents: -line.amountCents,
          status: 'categorized',
          origin: 'schedule',
          transferGroupId,
        },
      ],
      { transaction },
    )
    await addOperationTags(
      data,
      userId,
      movements.map((movement) => movement.id),
      createdTagIds,
      transaction,
    )
    return 'created'
  }
  const chosenCategory = categoryId ?? schedule.categoryId
  const created = await data.models.Transaction.create(
    {
      ...common,
      accountId: line.accountId,
      paymentMethodId: schedule.paymentMethodId,
      amountCents: line.amountCents,
      bankLabel: line.bankLabel,
      dedupHash: line.dedupHash,
      categoryId: chosenCategory,
      status: chosenCategory === null ? 'to_categorize' : 'categorized',
      origin: 'import',
    },
    { transaction },
  )
  await addOperationTags(data, userId, [created.id], createdTagIds, transaction)
  return 'created'
}

export async function findTransferCounterpart(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  counterpartAccountId: string,
  excludedIds: ReadonlySet<string>,
  transaction?: Transaction,
): Promise<TransactionModel | null> {
  const candidates = await data.models.Transaction.findAll({
    where: {
      userId,
      accountId: counterpartAccountId,
      amountCents: -operation.amountCents,
      transferGroupId: null,
      occurrenceId: null,
      date: {
        [Op.between]: [
          addDays(operation.date, -transferPairingDays),
          addDays(operation.date, transferPairingDays),
        ],
      },
    },
    transaction,
  })
  const [closest] = candidates
    .filter((candidate) => !excludedIds.has(candidate.id))
    .sort(
      (first, second) =>
        Math.abs(daysBetween(operation.date, first.date)) -
          Math.abs(daysBetween(operation.date, second.date)) ||
        first.createdAt.getTime() - second.createdAt.getTime(),
    )
  return closest ?? null
}

export async function linkOrCreateCounterpart(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  counterpartAccountId: string,
  batchId: string | null,
  transaction: Transaction,
): Promise<TransactionModel> {
  const transferGroupId = operation.transferGroupId ?? randomUUID()
  const closest = await findTransferCounterpart(
    data,
    userId,
    operation,
    counterpartAccountId,
    new Set(),
    transaction,
  )
  if (closest !== null) {
    await closest.update(
      {
        ...(batchId === null
          ? {}
          : {
              preMergeSnapshot: await snapshotWithTags(
                data,
                closest,
                transaction,
              ),
              importBatchId: batchId,
            }),
        transferGroupId,
        categoryId: null,
        status: 'categorized',
      },
      { transaction },
    )
    return closest
  }
  const counterpart = await findUserAccount(
    data,
    userId,
    counterpartAccountId,
    transaction,
  )
  if (operation.date < counterpart.initialBalanceDate) {
    throw conflict('operations_before_initial_balance')
  }
  return data.models.Transaction.create(
    {
      userId,
      accountId: counterpart.id,
      date: operation.date,
      amountCents: -operation.amountCents,
      label: operation.label,
      note: operation.note,
      status: 'categorized',
      origin: 'manual',
      transferGroupId,
      importBatchId: batchId,
    },
    { transaction },
  )
}

export async function reconcileOperation(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  target: OccurrenceTarget,
  transaction: Transaction,
): Promise<void> {
  if (operation.transferGroupId !== null) {
    throw conflict('operation_is_transfer')
  }
  if (operation.occurrenceId !== null) {
    throw conflict('operation_reconciled')
  }
  const occurrence = await requireCandidate(
    data,
    userId,
    {
      accountId: operation.accountId,
      date: operation.date,
      amountCents: operation.amountCents,
      bankLabel: operation.bankLabel ?? operation.label,
    },
    target,
    transaction,
  )
  const schedule = await findSchedule(
    data,
    userId,
    target.scheduleId,
    transaction,
  )
  if (schedule.kind === 'transfer') {
    throw conflict('occurrence_not_candidate')
  }
  if (occurrence.operationId !== null) {
    const linked = await data.models.Transaction.findOne({
      where: { id: occurrence.operationId, userId },
      transaction,
    })
    if (linked === null || linked.origin !== 'schedule') {
      throw conflict('occurrence_not_candidate')
    }
    const row = await executedRow(data, target, transaction)
    await shareTagsAcross(data, userId, [operation, linked], [], transaction)
    await linked.destroy({ transaction })
    await operation.update({ occurrenceId: row.id }, { transaction })
    await syncExecutedOccurrence(data, operation, transaction)
  } else {
    const row = await markExecuted(
      data,
      target,
      operation.date,
      operation.amountCents,
      transaction,
    )
    await operation.update({ occurrenceId: row.id }, { transaction })
    await addOperationTags(
      data,
      userId,
      [operation.id],
      (await tagIdsBySchedule(data, [schedule.id], transaction)).get(
        schedule.id,
      ) ?? [],
      transaction,
    )
  }
  if (operation.bankLabel !== null) {
    await learnBankLabel(schedule, operation.bankLabel, transaction)
  }
}

export async function dissociateOperation(
  data: DataAccess,
  userId: string,
  operation: TransactionModel,
  today: string,
  transaction: Transaction,
): Promise<void> {
  if (operation.occurrenceId === null || operation.origin === 'schedule') {
    throw conflict('operation_not_reconciled')
  }
  const row = await data.models.ScheduleOccurrence.findByPk(
    operation.occurrenceId,
    { transaction },
  )
  await operation.update({ occurrenceId: null }, { transaction })
  if (row === null) {
    return
  }
  const others = await data.models.Transaction.count({
    where: { occurrenceId: row.id },
    transaction,
  })
  if (others > 0) {
    return
  }
  const schedule = (await loadScheduleInputs(data, userId, transaction)).find(
    (input) => input.id === row.scheduleId,
  )
  const plannedDate =
    schedule === undefined
      ? row.originalDate
      : resolveOccurrence(schedule, row.originalDate, undefined).effectiveDate
  if (plannedDate <= today) {
    await row.update(
      { state: 'skipped', effectiveDate: null, amountCents: null },
      { transaction },
    )
  } else {
    await row.destroy({ transaction })
  }
}
