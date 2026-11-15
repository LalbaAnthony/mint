import type { z } from 'zod'
import type { updateScheduleRequestSchema } from '@mint/shared/schemas/schedules'
import type { AccountInput } from '@mint/shared/types/accounts'
import type {
  Schedule,
  ScheduleInput,
  ScheduleKind,
} from '@mint/shared/types/schedules'

export type ScheduleUpdate = z.output<typeof updateScheduleRequestSchema>

export type ScheduleDraft = ScheduleUpdate & {
  kind: ScheduleKind
}

export type ScheduleViews = {
  views: Schedule[]
  inputs: ScheduleInput[]
  accounts: AccountInput[]
}
