import type { ExecutionInput, PlannedExecution } from '../types/schedules.js'
import { compareCodeUnits } from './ordering.js'
import {
  activeAccountsById,
  postingMovements,
  postingStartDate,
} from './postings.js'
import { occurrencesBetween } from './recurrence.js'

function compareExecutions(
  first: PlannedExecution,
  second: PlannedExecution,
): number {
  return (
    compareCodeUnits(first.effectiveDate, second.effectiveDate) ||
    compareCodeUnits(first.scheduleId, second.scheduleId) ||
    compareCodeUnits(first.originalDate, second.originalDate)
  )
}

export function planExecutions(input: ExecutionInput): PlannedExecution[] {
  const activeAccounts = activeAccountsById(input.accounts)
  return input.schedules
    .flatMap((schedule) => {
      const start = postingStartDate(schedule, activeAccounts)
      if (start === null) {
        return []
      }
      return occurrencesBetween(schedule, start, input.today)
        .filter((occurrence) => occurrence.status === 'pending')
        .map((occurrence) => ({
          scheduleId: schedule.id,
          kind: schedule.posting.kind,
          label: schedule.label,
          originalDate: occurrence.originalDate,
          effectiveDate: occurrence.effectiveDate,
          amountCents: occurrence.amountCents,
          movements: postingMovements(schedule.posting, occurrence.amountCents),
        }))
    })
    .sort(compareExecutions)
}
