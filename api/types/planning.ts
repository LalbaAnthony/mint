import type { AppDependencies } from './app.js'

export type DataAccess = Pick<AppDependencies, 'sequelize' | 'models'>

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
