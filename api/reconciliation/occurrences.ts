import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { addDays, laterDate } from '@mint/shared/engines/dates'
import { normalizeBankLabel } from '@mint/shared/engines/labels'
import {
  activeAccountsById,
  postingMovements,
  postingStartDate,
} from '@mint/shared/engines/postings'
import {
  isCandidate,
  rankCandidates,
  reconciliationWindowDays,
} from '@mint/shared/engines/reconciliation'
import { occurrencesBetween } from '@mint/shared/engines/recurrence'
import { maxBankLabelPatterns } from '@mint/shared/schemas/schedules'
import type {
  ReconciliationLine,
  ReconciliationOccurrence,
  ScoredCandidate,
} from '@mint/shared/types/reconciliation'
import { conflict } from '../http/http-error.js'
import { loadAccountInputs, loadScheduleInputs } from '../planning/inputs.js'
import type { ScheduleModel, ScheduleOccurrenceModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import type { OccurrenceTarget } from '../types/reconciliation.js'

function occurrenceKey(scheduleId: string, originalDate: string): string {
  return `${scheduleId}|${originalDate}`
}

export async function loadReconciliationOccurrences(
  data: DataAccess,
  userId: string,
  accountId: string,
  from: string,
  to: string,
  transaction?: Transaction,
): Promise<ReconciliationOccurrence[]> {
  const schedules = await data.models.Schedule.findAll({
    where: { userId },
    transaction,
  })
  const settings = new Map(schedules.map((schedule) => [schedule.id, schedule]))
  const inputs = await loadScheduleInputs(data, userId, transaction)
  const activeAccounts = activeAccountsById(
    await loadAccountInputs(data, userId, transaction),
  )
  const executedRows =
    schedules.length === 0
      ? []
      : await data.models.ScheduleOccurrence.findAll({
          where: {
            scheduleId: { [Op.in]: schedules.map((schedule) => schedule.id) },
            state: 'executed',
          },
          transaction,
        })
  const rowByKey = new Map(
    executedRows.map((row) => [
      occurrenceKey(row.scheduleId, row.originalDate),
      row,
    ]),
  )
  const linked =
    executedRows.length === 0
      ? []
      : await data.models.Transaction.findAll({
          where: {
            userId,
            accountId,
            occurrenceId: { [Op.in]: executedRows.map((row) => row.id) },
          },
          transaction,
        })
  const linkedByRow = new Map(
    linked.flatMap((operation) =>
      operation.occurrenceId === null
        ? []
        : [[operation.occurrenceId, operation] as const],
    ),
  )
  return inputs.flatMap((input) => {
    const setting = settings.get(input.id)
    const lowerBound = postingStartDate(input, activeAccounts)
    if (setting === undefined || lowerBound === null) {
      return []
    }
    return occurrencesBetween(input, laterDate(lowerBound, from), to).flatMap(
      (occurrence): ReconciliationOccurrence[] => {
        if (occurrence.status === 'skipped') {
          return []
        }
        const movement = postingMovements(
          input.posting,
          occurrence.amountCents,
        ).find((candidate) => candidate.accountId === accountId)
        if (movement === undefined) {
          return []
        }
        const row = rowByKey.get(
          occurrenceKey(input.id, occurrence.originalDate),
        )
        const operation =
          row === undefined ? undefined : linkedByRow.get(row.id)
        return [
          {
            scheduleId: input.id,
            scheduleLabel: input.label,
            patterns: setting.bankLabelPatterns,
            tolerancePct: setting.amountTolerancePct,
            originalDate: occurrence.originalDate,
            effectiveDate: occurrence.effectiveDate,
            accountId,
            amountCents: movement.amountCents,
            operationId: operation?.id ?? null,
            reconciledWithBank:
              occurrence.status === 'executed' &&
              (operation === undefined || operation.origin === 'import'),
          },
        ]
      },
    )
  })
}

export async function rankedCandidatesFor(
  data: DataAccess,
  userId: string,
  line: ReconciliationLine,
  transaction?: Transaction,
): Promise<ScoredCandidate[]> {
  const occurrences = await loadReconciliationOccurrences(
    data,
    userId,
    line.accountId,
    addDays(line.date, -reconciliationWindowDays),
    addDays(line.date, reconciliationWindowDays),
    transaction,
  )
  return rankCandidates(line, occurrences)
}

export async function requireCandidate(
  data: DataAccess,
  userId: string,
  line: ReconciliationLine,
  target: OccurrenceTarget,
  transaction: Transaction,
): Promise<ReconciliationOccurrence> {
  const occurrences = await loadReconciliationOccurrences(
    data,
    userId,
    line.accountId,
    addDays(line.date, -reconciliationWindowDays),
    addDays(line.date, reconciliationWindowDays),
    transaction,
  )
  const occurrence = occurrences.find(
    (candidate) =>
      candidate.scheduleId === target.scheduleId &&
      candidate.originalDate === target.originalDate,
  )
  if (occurrence === undefined || !isCandidate(line, occurrence)) {
    throw conflict('occurrence_not_candidate')
  }
  return occurrence
}

export async function findSchedule(
  data: DataAccess,
  userId: string,
  scheduleId: string,
  transaction: Transaction,
): Promise<ScheduleModel> {
  const schedule = await data.models.Schedule.findOne({
    where: { id: scheduleId, userId },
    transaction,
  })
  if (schedule === null) {
    throw conflict('occurrence_not_candidate')
  }
  return schedule
}

export async function markExecuted(
  data: DataAccess,
  target: OccurrenceTarget,
  effectiveDate: string,
  amountCents: number,
  transaction: Transaction,
): Promise<ScheduleOccurrenceModel> {
  const values = {
    state: 'executed' as const,
    effectiveDate,
    amountCents: Math.abs(amountCents),
  }
  const row = await data.models.ScheduleOccurrence.findOne({
    where: {
      scheduleId: target.scheduleId,
      originalDate: target.originalDate,
    },
    transaction,
  })
  if (row === null) {
    return data.models.ScheduleOccurrence.create(
      {
        scheduleId: target.scheduleId,
        originalDate: target.originalDate,
        ...values,
      },
      { transaction },
    )
  }
  await row.update(values, { transaction })
  return row
}

export async function executedRow(
  data: DataAccess,
  target: OccurrenceTarget,
  transaction: Transaction,
): Promise<ScheduleOccurrenceModel> {
  const row = await data.models.ScheduleOccurrence.findOne({
    where: {
      scheduleId: target.scheduleId,
      originalDate: target.originalDate,
      state: 'executed',
    },
    transaction,
  })
  if (row === null) {
    throw conflict('occurrence_not_candidate')
  }
  return row
}

export async function learnBankLabel(
  schedule: ScheduleModel,
  bankLabel: string,
  transaction: Transaction,
): Promise<void> {
  const pattern = normalizeBankLabel(bankLabel)
  if (
    schedule.bankLabelPatterns.includes(pattern) ||
    schedule.bankLabelPatterns.length >= maxBankLabelPatterns
  ) {
    return
  }
  await schedule.update(
    { bankLabelPatterns: [...schedule.bankLabelPatterns, pattern] },
    { transaction },
  )
}
