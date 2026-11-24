import { Op } from 'sequelize'
import { addDays } from '@mint/shared/engines/dates'
import {
  activeAccountsById,
  postingStartDate,
} from '@mint/shared/engines/postings'
import { occurrencesBetween } from '@mint/shared/engines/recurrence'
import { maxReminderDaysBefore } from '@mint/shared/schemas/schedules'
import type { AccountInput } from '@mint/shared/types/accounts'
import type {
  DataAccess,
  ManualScheduleOccurrences,
} from '../types/planning.js'
import { loadScheduleInputs } from './inputs.js'

async function matchedOccurrences(
  data: DataAccess,
  scheduleIds: readonly string[],
  from: string,
  to: string,
): Promise<Set<string>> {
  if (scheduleIds.length === 0) {
    return new Set()
  }
  const executed = await data.models.ScheduleOccurrence.findAll({
    attributes: ['id', 'scheduleId', 'originalDate'],
    where: {
      scheduleId: { [Op.in]: [...scheduleIds] },
      state: 'executed',
      originalDate: { [Op.between]: [addDays(from, -7), to] },
    },
  })
  if (executed.length === 0) {
    return new Set()
  }
  const paid = await data.models.Transaction.findAll({
    attributes: ['occurrenceId'],
    where: {
      occurrenceId: { [Op.in]: executed.map((row) => row.id) },
      origin: { [Op.ne]: 'schedule' },
    },
  })
  const paidIds = new Set(
    paid.flatMap((operation) => operation.occurrenceId ?? []),
  )
  return new Set(
    executed
      .filter((row) => paidIds.has(row.id))
      .map((row) => `${row.scheduleId}|${row.originalDate}`),
  )
}

export async function loadManualOccurrences(
  data: DataAccess,
  userId: string,
  accounts: readonly AccountInput[],
  today: string,
): Promise<ManualScheduleOccurrences[]> {
  const schedules = await data.models.Schedule.findAll({
    where: { userId, triggerMode: 'manual', active: true, isSystem: false },
  })
  if (schedules.length === 0) {
    return []
  }
  const inputs = await loadScheduleInputs(data, userId)
  const activeAccounts = activeAccountsById(accounts)
  const until = addDays(today, maxReminderDaysBefore)
  const matched = await matchedOccurrences(
    data,
    schedules.map((schedule) => schedule.id),
    today,
    until,
  )
  return schedules.flatMap((schedule) => {
    const input = inputs.find((candidate) => candidate.id === schedule.id)
    if (
      input === undefined ||
      postingStartDate(input, activeAccounts) === null
    ) {
      return []
    }
    return [
      {
        schedule,
        accountId:
          input.posting.kind === 'transfer'
            ? input.posting.sourceAccountId
            : input.posting.accountId,
        occurrences: occurrencesBetween(input, today, until).map(
          (occurrence) => ({
            scheduleId: schedule.id,
            originalDate: occurrence.originalDate,
            effectiveDate: occurrence.effectiveDate,
            amountCents: occurrence.amountCents,
            status: occurrence.status,
            matched: matched.has(`${schedule.id}|${occurrence.originalDate}`),
          }),
        ),
      },
    ]
  })
}
