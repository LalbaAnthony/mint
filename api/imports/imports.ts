import { randomUUID } from 'node:crypto'
import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { dedupHashes, interpretRows } from '@mint/shared/engines/csv-lines'
import { addDays } from '@mint/shared/engines/dates'
import {
  rankCandidates,
  reconciliationWindowDays,
} from '@mint/shared/engines/reconciliation'
import { firstMatchingRule } from '@mint/shared/engines/rules'
import { csvMappingSchema } from '@mint/shared/schemas/imports'
import type {
  CsvMapping,
  ImportBatch,
  ImportBatchView,
  ImportCandidate,
  ImportRow,
  ImportRowDecision,
  ValidateImportRequest,
} from '@mint/shared/types/imports'
import { findUserAccount } from '../accounts/accounts.js'
import { findUserCategory } from '../categories/categories.js'
import { conflict, notFound, validationFailed } from '../http/http-error.js'
import { createRegexMatcher, loadRuleInputs } from '../rules/rules.js'
import { addOperationTags } from '../tags/tags.js'
import {
  linkOrCreateCounterpart,
  reconcileBankLine,
  restoreSnapshot,
  shareTagsAcross,
} from '../reconciliation/apply.js'
import { loadReconciliationOccurrences } from '../reconciliation/occurrences.js'
import {
  storedCandidatesSchema,
  storedRawRowSchema,
} from '../schemas/imports.js'
import type { BankLine, RowPlan } from '../types/imports.js'
import type {
  ImportBatchModel,
  ImportMappingModel,
  ImportRowModel,
} from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import { guessMapping, readFileRows, sampleLineCount } from './csv.js'

export function toImportBatch(batch: ImportBatchModel): ImportBatch {
  return {
    id: batch.id,
    accountId: batch.accountId,
    filename: batch.filename,
    status: batch.status,
    rowsRead: batch.rowsRead,
    rowsCreated: batch.rowsCreated,
    rowsDuplicate: batch.rowsDuplicate,
    rowsMerged: batch.rowsMerged,
    createdAt: batch.createdAt.toISOString(),
    validatedAt: batch.validatedAt?.toISOString() ?? null,
    cancelledAt: batch.cancelledAt?.toISOString() ?? null,
  }
}

function mappingOf(model: ImportMappingModel): CsvMapping {
  return csvMappingSchema.parse({
    delimiter: model.delimiter,
    encoding: model.encoding,
    hasHeader: model.hasHeader,
    skipTop: model.skipTop,
    skipBottom: model.skipBottom,
    dateFormat: model.dateFormat,
    decimalSeparator: model.decimalSeparator,
    colDate: model.colDate,
    colLabel: model.colLabel,
    colAmount: model.colAmount,
    colDebit: model.colDebit,
    colCredit: model.colCredit,
  })
}

function toImportRow(row: ImportRowModel): ImportRow {
  return {
    rowIndex: row.rowIndex,
    raw: storedRawRowSchema.parse(row.raw),
    date: row.date,
    amountCents: row.amountCents,
    bankLabel: row.bankLabel,
    error: row.error,
    duplicate: row.duplicate,
    ruleId: row.proposedRuleId,
    categoryId: row.proposedCategoryId,
    transferAccountId: row.proposedTransferAccountId,
    tagIds: row.proposedTagIds,
    candidates: storedCandidatesSchema.parse(row.candidates),
  }
}

export async function findUserBatch(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<ImportBatchModel> {
  const batch = await data.models.ImportBatch.findOne({
    where: { id, userId },
    transaction,
  })
  if (batch === null) {
    throw notFound()
  }
  return batch
}

export function ensurePending(batch: ImportBatchModel): Buffer {
  if (batch.status !== 'pending' || batch.rawFile === null) {
    throw conflict('import_not_pending')
  }
  return batch.rawFile
}

async function rememberedMapping(
  data: DataAccess,
  accountId: string,
  transaction?: Transaction,
): Promise<CsvMapping | null> {
  const stored = await data.models.ImportMapping.findOne({
    where: { accountId },
    transaction,
  })
  return stored === null ? null : mappingOf(stored)
}

async function stagedRows(
  data: DataAccess,
  batchId: string,
  transaction?: Transaction,
): Promise<ImportRowModel[]> {
  return data.models.ImportRow.findAll({
    where: { batchId },
    order: [['rowIndex', 'ASC']],
    transaction,
  })
}

export async function batchView(
  data: DataAccess,
  batch: ImportBatchModel,
  mapping?: CsvMapping,
): Promise<ImportBatchView> {
  const remembered = await rememberedMapping(data, batch.accountId)
  const effective =
    mapping ?? remembered ?? guessMapping(batch.rawFile ?? Buffer.alloc(0))
  const rows = await stagedRows(data, batch.id)
  return {
    batch: toImportBatch(batch),
    mapping: effective,
    mappingRemembered: remembered !== null,
    sampleLines:
      batch.rawFile === null
        ? []
        : readFileRows(batch.rawFile, effective).slice(0, sampleLineCount),
    rows: rows.map(toImportRow),
  }
}

export async function createBatch(
  data: DataAccess,
  userId: string,
  accountId: string,
  filename: string,
  bytes: Buffer,
): Promise<ImportBatchModel> {
  const account = await findUserAccount(data, userId, accountId)
  if (account.archivedAt !== null) {
    throw conflict('account_archived')
  }
  if (bytes.length === 0) {
    throw validationFailed([{ path: ['file'], message: 'required' }])
  }
  return data.models.ImportBatch.create({
    userId,
    accountId,
    filename,
    status: 'pending',
    rawFile: bytes,
  })
}

function toCandidate(
  candidate: ReturnType<typeof rankCandidates>[number],
): ImportCandidate {
  return {
    scheduleId: candidate.occurrence.scheduleId,
    scheduleLabel: candidate.occurrence.scheduleLabel,
    originalDate: candidate.occurrence.originalDate,
    effectiveDate: candidate.occurrence.effectiveDate,
    amountCents: candidate.occurrence.amountCents,
    operationId: candidate.occurrence.operationId,
    score: candidate.score,
  }
}

function claimBestCandidates(lines: RowPlan[]): void {
  const pairs = lines
    .flatMap((line, lineIndex) =>
      line.candidates.map((candidate) => ({ lineIndex, candidate })),
    )
    .sort((first, second) => second.candidate.score - first.candidate.score)
  const claimedOccurrences = new Set<string>()
  const servedLines = new Set<number>()
  for (const { lineIndex, candidate } of pairs) {
    const key = `${candidate.scheduleId}|${candidate.originalDate}`
    if (servedLines.has(lineIndex) || claimedOccurrences.has(key)) {
      continue
    }
    const line = lines[lineIndex]
    if (line === undefined) {
      continue
    }
    claimedOccurrences.add(key)
    servedLines.add(lineIndex)
    line.candidates = [
      candidate,
      ...line.candidates.filter((other) => other !== candidate),
    ]
    line.proposed = candidate
  }
}

export async function previewBatch(
  data: DataAccess,
  userId: string,
  batch: ImportBatchModel,
  mapping: CsvMapping,
): Promise<void> {
  const rawFile = ensurePending(batch)
  const account = await findUserAccount(data, userId, batch.accountId)
  const lines = interpretRows(readFileRows(rawFile, mapping), mapping).map(
    (line) =>
      line.error === null && line.date < account.initialBalanceDate
        ? { ...line, error: 'date_before_initial_balance' as const }
        : line,
  )
  const valid = lines.flatMap((line) => (line.error === null ? [line] : []))
  const hashes = dedupHashes(valid)
  const existing = new Set(
    hashes.length === 0
      ? []
      : (
          await data.models.Transaction.findAll({
            attributes: ['dedupHash'],
            where: {
              userId,
              accountId: account.id,
              dedupHash: { [Op.in]: hashes },
            },
          })
        ).flatMap((operation) => operation.dedupHash ?? []),
  )
  const rules = await loadRuleInputs(data, userId)
  const matcher = createRegexMatcher()
  const dates = valid.map((line) => line.date).sort()
  const occurrences =
    dates.length === 0
      ? []
      : await loadReconciliationOccurrences(
          data,
          userId,
          account.id,
          addDays(dates[0] ?? '', -reconciliationWindowDays),
          addDays(dates.at(-1) ?? '', reconciliationWindowDays),
        )
  const plans: RowPlan[] = valid.map((line, index) => {
    const hash = hashes[index] ?? ''
    const duplicate = existing.has(hash)
    const rule = firstMatchingRule(
      rules,
      {
        accountId: account.id,
        amountCents: line.amountCents,
        bankLabel: line.bankLabel,
      },
      matcher,
    )
    return {
      line,
      hash,
      duplicate,
      ruleId: rule?.id ?? null,
      categoryId: rule?.categoryId ?? null,
      transferAccountId: rule?.transferAccountId ?? null,
      tagIds: rule?.tagIds ?? [],
      candidates: duplicate
        ? []
        : rankCandidates(
            {
              accountId: account.id,
              date: line.date,
              amountCents: line.amountCents,
              bankLabel: line.bankLabel,
            },
            occurrences,
          ).map(toCandidate),
      proposed: null,
    }
  })
  claimBestCandidates(plans)
  const planByIndex = new Map(plans.map((plan) => [plan.line.rowIndex, plan]))
  await data.sequelize.transaction(async (transaction) => {
    await data.models.ImportRow.destroy({
      where: { batchId: batch.id },
      transaction,
    })
    await data.models.ImportRow.bulkCreate(
      lines.map((line) => {
        const plan = planByIndex.get(line.rowIndex)
        return {
          batchId: batch.id,
          rowIndex: line.rowIndex,
          raw: line.raw,
          date: line.date,
          amountCents: line.amountCents,
          bankLabel: line.bankLabel,
          dedupHash: plan?.hash ?? null,
          error: line.error,
          duplicate: plan?.duplicate ?? false,
          proposedRuleId: plan?.ruleId ?? null,
          proposedCategoryId: plan?.categoryId ?? null,
          proposedTransferAccountId: plan?.transferAccountId ?? null,
          proposedScheduleId: plan?.proposed?.scheduleId ?? null,
          proposedOriginalDate: plan?.proposed?.originalDate ?? null,
          proposedTagIds: plan?.tagIds ?? [],
          candidates: plan?.candidates ?? [],
        }
      }),
      { transaction },
    )
    await batch.update({ rowsRead: lines.length }, { transaction })
  })
}

function defaultDecision(row: ImportRowModel): ImportRowDecision {
  return {
    rowIndex: row.rowIndex,
    include: !row.duplicate,
    categoryId: row.proposedCategoryId,
    transferAccountId:
      row.proposedCategoryId === null ? row.proposedTransferAccountId : null,
    reconcile:
      row.proposedScheduleId === null || row.proposedOriginalDate === null
        ? null
        : {
            scheduleId: row.proposedScheduleId,
            originalDate: row.proposedOriginalDate,
          },
  }
}

function bankLineOf(row: ImportRowModel, accountId: string): BankLine {
  if (
    row.date === null ||
    row.amountCents === null ||
    row.bankLabel === null ||
    row.dedupHash === null
  ) {
    throw new Error(`Import row ${row.id} is not valid`)
  }
  return {
    accountId,
    date: row.date,
    amountCents: row.amountCents,
    bankLabel: row.bankLabel,
    dedupHash: row.dedupHash,
  }
}

async function validateDecisionReferences(
  data: DataAccess,
  userId: string,
  accountId: string,
  decision: ImportRowDecision,
  transaction: Transaction,
): Promise<void> {
  if (decision.categoryId !== null) {
    const category = await findUserCategory(
      data,
      userId,
      decision.categoryId,
      transaction,
    )
    if (category.kind === 'adjustment') {
      throw validationFailed([
        {
          path: ['decisions', 'categoryId'],
          message: 'adjustment_not_allowed',
        },
      ])
    }
    if (category.archivedAt !== null) {
      throw conflict('category_archived')
    }
  }
  if (decision.transferAccountId !== null) {
    const target = await findUserAccount(
      data,
      userId,
      decision.transferAccountId,
      transaction,
    )
    if (target.archivedAt !== null) {
      throw conflict('account_archived')
    }
    if (target.id === accountId) {
      throw validationFailed([
        { path: ['decisions', 'transferAccountId'], message: 'same_account' },
      ])
    }
  }
}

export async function validateBatch(
  data: DataAccess,
  userId: string,
  batch: ImportBatchModel,
  request: ValidateImportRequest,
  now: Date,
): Promise<void> {
  ensurePending(batch)
  await data.sequelize.transaction(async (transaction) => {
    const rows = await stagedRows(data, batch.id, transaction)
    if (rows.length === 0) {
      throw conflict('import_not_previewed')
    }
    const decisions = new Map(
      request.decisions.map((decision) => [decision.rowIndex, decision]),
    )
    const checked = new Set<string>()
    let created = 0
    let merged = 0
    let duplicates = 0
    const plain: ReturnType<typeof bankLineOf>[] = []
    const plainCategories: (string | null)[] = []
    const plainTags: string[][] = []
    for (const row of rows) {
      if (row.error !== null) {
        continue
      }
      const decision = decisions.get(row.rowIndex) ?? defaultDecision(row)
      if (!decision.include) {
        if (row.duplicate) {
          duplicates += 1
        }
        continue
      }
      const key = `${decision.categoryId ?? ''}|${decision.transferAccountId ?? ''}`
      if (!checked.has(key)) {
        await validateDecisionReferences(
          data,
          userId,
          batch.accountId,
          decision,
          transaction,
        )
        checked.add(key)
      }
      const line = bankLineOf(row, batch.accountId)
      if (decision.reconcile !== null) {
        const outcome = await reconcileBankLine(
          data,
          userId,
          line,
          decision.reconcile,
          batch.id,
          decision.categoryId,
          row.proposedTagIds,
          transaction,
        )
        if (outcome === 'merged') {
          merged += 1
        } else {
          created += 1
        }
        continue
      }
      if (decision.transferAccountId !== null) {
        const operation = await data.models.Transaction.create(
          {
            userId,
            accountId: line.accountId,
            date: line.date,
            amountCents: line.amountCents,
            label: line.bankLabel,
            bankLabel: line.bankLabel,
            dedupHash: line.dedupHash,
            importBatchId: batch.id,
            status: 'categorized',
            origin: 'import',
            transferGroupId: randomUUID(),
          },
          { transaction },
        )
        const counterpart = await linkOrCreateCounterpart(
          data,
          userId,
          operation,
          decision.transferAccountId,
          batch.id,
          transaction,
        )
        await shareTagsAcross(
          data,
          userId,
          [operation, counterpart],
          row.proposedTagIds,
          transaction,
        )
        created += 1
        continue
      }
      plain.push(line)
      plainCategories.push(decision.categoryId)
      plainTags.push(row.proposedTagIds)
    }
    const plainOperations = await data.models.Transaction.bulkCreate(
      plain.map((line, index) => {
        const categoryId = plainCategories[index] ?? null
        return {
          userId,
          accountId: line.accountId,
          date: line.date,
          amountCents: line.amountCents,
          label: line.bankLabel,
          bankLabel: line.bankLabel,
          dedupHash: line.dedupHash,
          importBatchId: batch.id,
          categoryId,
          status: categoryId === null ? 'to_categorize' : 'categorized',
          origin: 'import',
        }
      }),
      { transaction },
    )
    for (const [index, operation] of plainOperations.entries()) {
      await addOperationTags(
        data,
        userId,
        [operation.id],
        plainTags[index] ?? [],
        transaction,
      )
    }
    created += plain.length
    await upsertMapping(
      data,
      userId,
      batch.accountId,
      request.mapping,
      transaction,
    )
    await data.models.ImportRow.destroy({
      where: { batchId: batch.id },
      transaction,
    })
    await batch.update(
      {
        status: 'validated',
        rawFile: null,
        rowsCreated: created,
        rowsMerged: merged,
        rowsDuplicate: duplicates,
        validatedAt: now,
      },
      { transaction },
    )
  })
}

async function upsertMapping(
  data: DataAccess,
  userId: string,
  accountId: string,
  mapping: CsvMapping,
  transaction: Transaction,
): Promise<void> {
  const existing = await data.models.ImportMapping.findOne({
    where: { accountId },
    transaction,
  })
  if (existing === null) {
    await data.models.ImportMapping.create(
      { userId, accountId, ...mapping },
      { transaction },
    )
  } else {
    await existing.update(mapping, { transaction })
  }
}

export async function cancelBatch(
  data: DataAccess,
  batch: ImportBatchModel,
  now: Date,
): Promise<void> {
  if (batch.status !== 'validated') {
    throw conflict('import_not_validated')
  }
  await data.sequelize.transaction(async (transaction) => {
    const touched = await data.models.Transaction.findAll({
      where: { importBatchId: batch.id },
      transaction,
    })
    const occurrenceIds = new Set(
      touched.flatMap((operation) => operation.occurrenceId ?? []),
    )
    const createdIds = touched
      .filter((operation) => operation.preMergeSnapshot === null)
      .map((operation) => operation.id)
    for (const operation of touched) {
      if (operation.preMergeSnapshot !== null) {
        await restoreSnapshot(data, operation, transaction)
      }
    }
    if (createdIds.length > 0) {
      await data.models.Transaction.destroy({
        where: { id: { [Op.in]: createdIds } },
        transaction,
      })
    }
    for (const occurrenceId of occurrenceIds) {
      const remaining = await data.models.Transaction.count({
        where: { occurrenceId },
        transaction,
      })
      if (remaining === 0) {
        await data.models.ScheduleOccurrence.destroy({
          where: { id: occurrenceId, state: 'executed' },
          transaction,
        })
      }
    }
    await batch.update(
      { status: 'cancelled', cancelledAt: now },
      { transaction },
    )
  })
}
