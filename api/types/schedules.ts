import type { z } from 'zod'
import type { updateScheduleRequestSchema } from '@mint/shared/schemas/schedules'
import type { ScheduleKind } from '@mint/shared/types/schedules'

export type ScheduleUpdate = z.output<typeof updateScheduleRequestSchema>

export type ScheduleDraft = ScheduleUpdate & {
  kind: ScheduleKind
}
