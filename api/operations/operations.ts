import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import type { Transaction, WhereOptions } from 'sequelize'
import { createOperationRequestSchema } from '@mint/shared/schemas/operations'
import type {
  CreateOperationRequest,
  CreateTransferRequest,
  Operation,
  Transfer,
} from '@mint/shared/types/operations'
import { findUserAccount } from '../accounts/accounts.js'
import { findUserCategory } from '../categories/categories.js'
import {
  conflict,
  notFound,
  toIssues,
  validationFailed,
} from '../http/http-error.js'
import { findUserPaymentMethod } from '../payment-methods/payment-methods.js'
import type {
  AccountModel,
  TransactionAttributes,
  TransactionModel,
} from '../types/models.js'
import type { OperationFields, TransferMovements } from '../types/operations.js'
import type { DataAccess } from '../types/planning.js'

export async function accountsWithValidatedImport(
  data: DataAccess,
  accountIds: readonly string[],
  transaction?: Transaction,
): Promise<Set<string>> {
  if (accountIds.length === 0) {
    return new Set()
  }
  const batches = await data.models.ImportBatch.findAll({
    attributes: ['accountId'],
    where: { accountId: { [Op.in]: [...accountIds] }, status: 'validated' },
    transaction,
  })
  return new Set(batches.map((batch) => batch.accountId))
}

export async function toOperations(
  data: DataAccess,
  rows: readonly TransactionModel[],
  transaction?: Transaction,
): Promise<Operation[]> {
  const groupIds = [
    ...new Set(rows.flatMap((row) => row.transferGroupId ?? [])),
  ]
  const occurrenceIds = [
    ...new Set(rows.flatMap((row) => row.occurrenceId ?? [])),
  ]
  const movements =
    groupIds.length === 0
      ? []
      : await data.models.Transaction.findAll({
          attributes: ['id', 'accountId', 'transferGroupId'],
          where: { transferGroupId: { [Op.in]: groupIds } },
          transaction,
        })
  const occurrences =
    occurrenceIds.length === 0
      ? []
      : await data.models.ScheduleOccurrence.findAll({
          attributes: ['id', 'scheduleId', 'originalDate'],
          where: { id: { [Op.in]: occurrenceIds } },
          transaction,
        })
  const occurrencesById = new Map(
    occurrences.map((occurrence) => [occurrence.id, occurrence]),
  )
  const importedAccounts = await accountsWithValidatedImport(
    data,
    [...new Set(rows.map((row) => row.accountId))],
    transaction,
  )
  return rows.map((row) => {
    const occurrence =
      row.occurrenceId === null
        ? undefined
        : occurrencesById.get(row.occurrenceId)
    const counterpart =
      row.transferGroupId === null
        ? undefined
        : movements.find(
            (movement) =>
              movement.transferGroupId === row.transferGroupId &&
              movement.id !== row.id,
          )
    return {
      id: row.id,
      accountId: row.accountId,
      paymentMethodId: row.paymentMethodId,
      date: row.date,
      amountCents: row.amountCents,
      label: row.label,
      note: row.note,
      categoryId: row.categoryId,
      status: row.status,
      origin: row.origin,
      transferGroupId: row.transferGroupId,
      counterpartAccountId: counterpart?.accountId ?? null,
      scheduleId: occurrence?.scheduleId ?? null,
      occurrenceDate: occurrence?.originalDate ?? null,
      bankLabel: row.bankLabel,
      reconciled: row.occurrenceId !== null && row.origin !== 'schedule',
      unconfirmed:
        row.origin === 'schedule' && importedAccounts.has(row.accountId),
    }
  })
}

export async function toOperation(
  data: DataAccess,
  row: TransactionModel,
  transaction?: Transaction,
): Promise<Operation> {
  const [operation] = await toOperations(data, [row], transaction)
  if (operation === undefined) {
    throw new Error(`Operation ${row.id} could not be read`)
  }
  return operation
}

export async function findUserOperation(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<TransactionModel> {
  const operation = await data.models.Transaction.findOne({
    where: { id, userId },
    transaction,
  })
  if (operation === null) {
    throw notFound()
  }
  return operation
}

export async function findTransferMovements(
  data: DataAccess,
  userId: string,
  transferGroupId: string,
  transaction?: Transaction,
): Promise<TransferMovements> {
  const movements = await data.models.Transaction.findAll({
    where: { userId, transferGroupId },
    transaction,
  })
  const source = movements.find((movement) => movement.amountCents < 0)
  const target = movements.find((movement) => movement.amountCents > 0)
  if (movements.length !== 2 || source === undefined || target === undefined) {
    throw notFound()
  }
  return { source, target }
}

export async function toTransfer(
  data: DataAccess,
  movements: TransferMovements,
  transaction?: Transaction,
): Promise<Transfer> {
  const [source, target] = await toOperations(
    data,
    [movements.source, movements.target],
    transaction,
  )
  if (
    source === undefined ||
    target === undefined ||
    movements.source.transferGroupId === null
  ) {
    throw new Error('Transfer could not be read')
  }
  return { transferGroupId: movements.source.transferGroupId, source, target }
}

function ensureDateCounted(account: AccountModel, date: string): void {
  if (date < account.initialBalanceDate) {
    throw validationFailed([
      { path: ['date'], message: 'date_before_initial_balance' },
    ])
  }
}

async function usableAccount(
  data: DataAccess,
  userId: string,
  accountId: string,
  isNewReference: boolean,
  transaction?: Transaction,
): Promise<AccountModel> {
  const account = await findUserAccount(data, userId, accountId, transaction)
  if (isNewReference && account.archivedAt !== null) {
    throw conflict('account_archived')
  }
  return account
}

export async function validateOperationReferences(
  data: DataAccess,
  userId: string,
  fields: OperationFields,
  previous: TransactionModel | null,
  transaction?: Transaction,
): Promise<void> {
  const account = await usableAccount(
    data,
    userId,
    fields.accountId,
    previous?.accountId !== fields.accountId,
    transaction,
  )
  ensureDateCounted(account, fields.date)
  if (fields.paymentMethodId !== null) {
    const paymentMethod = await findUserPaymentMethod(
      data,
      userId,
      fields.paymentMethodId,
      transaction,
    )
    const pairChanged =
      previous === null ||
      previous.paymentMethodId !== paymentMethod.id ||
      previous.accountId !== fields.accountId
    if (pairChanged && paymentMethod.accountId !== fields.accountId) {
      throw validationFailed([
        { path: ['paymentMethodId'], message: 'payment_method_mismatch' },
      ])
    }
    if (
      previous?.paymentMethodId !== paymentMethod.id &&
      paymentMethod.archivedAt !== null
    ) {
      throw conflict('payment_method_archived')
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

export function parseOperationFields(fields: unknown): OperationFields {
  const parsed = createOperationRequestSchema.safeParse(fields)
  if (!parsed.success) {
    throw validationFailed(toIssues(parsed.error))
  }
  return parsed.data
}

export function operationFieldsOf(
  row: TransactionModel,
): CreateOperationRequest {
  return {
    accountId: row.accountId,
    paymentMethodId: row.paymentMethodId,
    date: row.date,
    amountCents: row.amountCents,
    label: row.label,
    note: row.note,
    categoryId: row.categoryId,
  }
}

export function statusFor(categoryId: string | null) {
  return categoryId === null ? 'to_categorize' : 'categorized'
}

export async function syncExecutedOccurrence(
  data: DataAccess,
  row: TransactionModel,
  transaction: Transaction,
): Promise<void> {
  if (row.occurrenceId === null) {
    return
  }
  await data.models.ScheduleOccurrence.update(
    { effectiveDate: row.date, amountCents: Math.abs(row.amountCents) },
    { where: { id: row.occurrenceId, state: 'executed' }, transaction },
  )
}

export async function validateTransferAccounts(
  data: DataAccess,
  userId: string,
  fields: CreateTransferRequest,
  previous: TransferMovements | null,
  transaction?: Transaction,
): Promise<void> {
  if (fields.sourceAccountId === fields.targetAccountId) {
    throw validationFailed([
      { path: ['targetAccountId'], message: 'same_account' },
    ])
  }
  const source = await usableAccount(
    data,
    userId,
    fields.sourceAccountId,
    previous?.source.accountId !== fields.sourceAccountId,
    transaction,
  )
  const target = await usableAccount(
    data,
    userId,
    fields.targetAccountId,
    previous?.target.accountId !== fields.targetAccountId,
    transaction,
  )
  ensureDateCounted(source, fields.date)
  ensureDateCounted(target, fields.date)
}

export async function createTransferMovements(
  data: DataAccess,
  userId: string,
  fields: CreateTransferRequest,
  transaction: Transaction,
): Promise<TransferMovements> {
  const transferGroupId = randomUUID()
  const common = {
    userId,
    date: fields.date,
    label: fields.label,
    note: fields.note ?? null,
    categoryId: null,
    status: 'categorized' as const,
    origin: 'manual' as const,
    transferGroupId,
  }
  const source = await data.models.Transaction.create(
    {
      ...common,
      accountId: fields.sourceAccountId,
      amountCents: -fields.amountCents,
    },
    { transaction },
  )
  const target = await data.models.Transaction.create(
    {
      ...common,
      accountId: fields.targetAccountId,
      amountCents: fields.amountCents,
    },
    { transaction },
  )
  return { source, target }
}

export function transferFieldsOf(
  movements: TransferMovements,
): CreateTransferRequest {
  return {
    sourceAccountId: movements.source.accountId,
    targetAccountId: movements.target.accountId,
    date: movements.source.date,
    amountCents: movements.target.amountCents,
    label: movements.source.label,
    note: movements.source.note,
  }
}

export function ensureNotTransfer(row: TransactionModel): void {
  if (row.transferGroupId !== null) {
    throw conflict('operation_is_transfer')
  }
}

export async function deleteOperationRows(
  data: DataAccess,
  userId: string,
  row: TransactionModel,
  transaction: Transaction,
): Promise<void> {
  const where: WhereOptions<TransactionAttributes> =
    row.transferGroupId === null
      ? { id: row.id, userId }
      : { transferGroupId: row.transferGroupId, userId }
  await data.models.Transaction.destroy({ where, transaction })
  if (row.occurrenceId !== null) {
    await data.models.ScheduleOccurrence.update(
      { state: 'skipped' },
      { where: { id: row.occurrenceId }, transaction },
    )
  }
}
