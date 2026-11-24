import type { ReminderOccurrence } from '@mint/shared/types/notifications'
import type { AppDependencies } from './app.js'
import type { ScheduleModel } from './models.js'

export type DataAccess = Pick<AppDependencies, 'sequelize' | 'models'>

export type ManualScheduleOccurrences = {
  schedule: ScheduleModel
  accountId: string
  occurrences: ReminderOccurrence[]
}

export type PostingReference = {
  id: string
  accountId: string | null
  paymentMethodId: string | null
}

export type ExecutionSummary = {
  users: number
  occurrences: number
  operations: number
  failures: number
}

export type ExecutionJobOutcome = 'completed' | 'failed' | 'locked'

export type HealthcheckSignal = 'start' | 'success' | 'fail'

export type HealthcheckPinger = (signal: HealthcheckSignal) => Promise<void>
