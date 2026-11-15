import type { z } from 'zod'
import type { AccountInput } from './accounts.js'
import type {
  businessDayRuleSchema,
  createScheduleRequestSchema,
  occurrenceStateSchema,
  occurrenceStatusSchema,
  overrideOccurrenceRequestSchema,
  scheduleFieldsSchema,
  scheduleFrequencySchema,
  scheduleKindSchema,
  scheduleListResponseSchema,
  scheduleOccurrenceListResponseSchema,
  scheduleOccurrenceSchema,
  scheduleSchema,
  scheduleTotalsSchema,
  triggerModeSchema,
  updateScheduleRequestSchema,
  updateScheduleResponseSchema,
} from '../schemas/schedules.js'

export type ScheduleKind = z.infer<typeof scheduleKindSchema>

export type ScheduleFrequency = z.infer<typeof scheduleFrequencySchema>

export type BusinessDayRule = z.infer<typeof businessDayRuleSchema>

export type TriggerMode = z.infer<typeof triggerModeSchema>

export type OccurrenceState = z.infer<typeof occurrenceStateSchema>

export type Recurrence = {
  frequency: ScheduleFrequency
  interval: number
  startDate: string
  anchorLastDay: boolean
  endDate: string | null
  maxOccurrences: number | null
  businessDayRule: BusinessDayRule
}

export type OccurrenceException = {
  originalDate: string
  state: OccurrenceState
  effectiveDate: string | null
  amountCents: number | null
}

export type OccurrenceStatus = 'pending' | 'skipped' | 'executed'

export type Occurrence = {
  originalDate: string
  effectiveDate: string
  amountCents: number
  status: OccurrenceStatus
  overridden: boolean
}

export type CategorizedPosting = {
  kind: 'expense' | 'income'
  accountId: string
  paymentMethodId: string | null
  categoryId: string
}

export type TransferPosting = {
  kind: 'transfer'
  sourceAccountId: string
  targetAccountId: string
}

export type SchedulePosting = CategorizedPosting | TransferPosting

export type ScheduleInput = {
  id: string
  label: string
  amountCents: number
  active: boolean
  isSubscription: boolean
  triggerMode: TriggerMode
  createdOn: string
  recurrence: Recurrence
  posting: SchedulePosting
  exceptions: OccurrenceException[]
}

export type OccurrenceSource = Pick<
  ScheduleInput,
  'amountCents' | 'recurrence' | 'exceptions'
>

export type PeriodicAmount = {
  amountCents: number
  frequency: ScheduleFrequency
  interval: number
}

export type EquivalentTotals = {
  monthlyCents: number
  annualCents: number
}

export type PlannedMovement = {
  accountId: string
  paymentMethodId: string | null
  categoryId: string | null
  amountCents: number
}

export type PlannedExecution = {
  scheduleId: string
  kind: ScheduleKind
  label: string
  originalDate: string
  effectiveDate: string
  amountCents: number
  movements: PlannedMovement[]
}

export type ExecutionInput = {
  today: string
  schedules: ScheduleInput[]
  accounts: AccountInput[]
}

export type ProjectedOccurrence = {
  schedule: ScheduleInput
  occurrence: Occurrence
  projectedDate: string
  movements: PlannedMovement[]
}

export type ScheduleFields = z.output<typeof scheduleFieldsSchema>

export type ScheduleFieldIssue = {
  path: string[]
  message: string
}

export type CreateScheduleRequest = z.input<typeof createScheduleRequestSchema>

export type UpdateScheduleRequest = z.input<typeof updateScheduleRequestSchema>

export type ScheduleOccurrenceStatus = z.infer<typeof occurrenceStatusSchema>

export type ScheduleOccurrence = z.infer<typeof scheduleOccurrenceSchema>

export type Schedule = z.infer<typeof scheduleSchema>

export type ScheduleTotals = z.infer<typeof scheduleTotalsSchema>

export type ScheduleListResponse = z.infer<typeof scheduleListResponseSchema>

export type UpdateScheduleResponse = z.infer<
  typeof updateScheduleResponseSchema
>

export type ScheduleOccurrenceListResponse = z.infer<
  typeof scheduleOccurrenceListResponseSchema
>

export type OverrideOccurrenceRequest = z.infer<
  typeof overrideOccurrenceRequestSchema
>
