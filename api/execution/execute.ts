import { randomUUID } from 'node:crypto'
import { QueryTypes } from 'sequelize'
import { planExecutions } from '@mint/shared/engines/execution'
import type { PlannedExecution } from '@mint/shared/types/schedules'
import { describeError, log } from '../logger.js'
import { loadAccountInputs, loadScheduleInputs } from '../planning/inputs.js'
import { insertedIdRowsSchema } from '../schemas/planning.js'
import { addOperationTags, tagIdsBySchedule } from '../tags/tags.js'
import type { DataAccess, ExecutionSummary } from '../types/planning.js'

async function executeOccurrence(
  data: DataAccess,
  userId: string,
  execution: PlannedExecution,
  tagIds: readonly string[],
): Promise<boolean> {
  return data.sequelize.transaction(async (transaction) => {
    const rows = await data.sequelize.query(
      `INSERT INTO schedule_occurrences
         (schedule_id, original_date, effective_date, amount_cents, state)
       VALUES (:scheduleId, :originalDate, :effectiveDate, :amountCents, 'executed')
       ON CONFLICT (schedule_id, original_date) DO UPDATE
         SET state = 'executed',
             effective_date = EXCLUDED.effective_date,
             amount_cents = EXCLUDED.amount_cents,
             updated_at = now()
         WHERE schedule_occurrences.state = 'overridden'
       RETURNING id`,
      {
        replacements: {
          scheduleId: execution.scheduleId,
          originalDate: execution.originalDate,
          effectiveDate: execution.effectiveDate,
          amountCents: execution.amountCents,
        },
        type: QueryTypes.SELECT,
        transaction,
      },
    )
    const [occurrence] = insertedIdRowsSchema.parse(rows)
    if (occurrence === undefined) {
      return false
    }
    const transferGroupId = execution.kind === 'transfer' ? randomUUID() : null
    const operations = await data.models.Transaction.bulkCreate(
      execution.movements.map((movement) => ({
        userId,
        accountId: movement.accountId,
        paymentMethodId: movement.paymentMethodId,
        date: execution.effectiveDate,
        amountCents: movement.amountCents,
        label: execution.label,
        note: null,
        categoryId: movement.categoryId,
        status:
          movement.categoryId !== null || transferGroupId !== null
            ? 'categorized'
            : 'to_categorize',
        origin: 'schedule',
        transferGroupId,
        occurrenceId: occurrence.id,
      })),
      { transaction },
    )
    await addOperationTags(
      data,
      userId,
      operations.map((operation) => operation.id),
      tagIds,
      transaction,
    )
    return true
  })
}

export async function executeDueOccurrences(
  data: DataAccess,
  today: string,
): Promise<ExecutionSummary> {
  const users = await data.models.User.findAll({
    attributes: ['id'],
    where: { status: 'active' },
  })
  const summary = {
    users: users.length,
    occurrences: 0,
    operations: 0,
    failures: 0,
  }
  for (const user of users) {
    const executions = planExecutions({
      today,
      schedules: await loadScheduleInputs(data, user.id),
      accounts: await loadAccountInputs(data, user.id),
    })
    const tagIds = await tagIdsBySchedule(
      data,
      executions.map((execution) => execution.scheduleId),
    )
    for (const execution of executions) {
      try {
        if (
          await executeOccurrence(
            data,
            user.id,
            execution,
            tagIds.get(execution.scheduleId) ?? [],
          )
        ) {
          summary.occurrences += 1
          summary.operations += execution.movements.length
        }
      } catch (error) {
        summary.failures += 1
        log('error', 'occurrence_execution_failed', {
          scheduleId: execution.scheduleId,
          originalDate: execution.originalDate,
          error: describeError(error),
        })
      }
    }
  }
  return summary
}
