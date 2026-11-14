import type { ExecutionInput, PlannedExecution } from '../types/schedules.js'
import { compareCodeUnits } from './ordering.js'
import { isPostable, postingMovements } from './postings.js'
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
  return input.schedules
    .filter((schedule) => isPostable(schedule, input.activeAccountIds))
    .flatMap((schedule) =>
      occurrencesBetween(schedule, schedule.createdOn, input.today)
        .filter((occurrence) => occurrence.status === 'pending')
        .map((occurrence) => ({
          scheduleId: schedule.id,
          kind: schedule.posting.kind,
          label: schedule.label,
          originalDate: occurrence.originalDate,
          effectiveDate: occurrence.effectiveDate,
          amountCents: occurrence.amountCents,
          movements: postingMovements(schedule.posting, occurrence.amountCents),
        })),
    )
    .sort(compareExecutions)
}
