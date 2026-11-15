import type { Express } from 'express'
import type { PushSender } from './notifications.js'
import type { Sequelize } from 'sequelize'
import type { AppDependencies } from './app.js'
import type { Clock } from './clock.js'
import type { DatabaseEnvironment } from './environment.js'
import type { createClient } from '../tests/context.js'
import type { Mailer, MailMessage } from './mail.js'
import type { UserModel } from './models.js'
import type { CreateScheduleRequest } from '@mint/shared/types/schedules'

export type TestDatabaseServer = Omit<DatabaseEnvironment, 'DATABASE_NAME'> & {
  maintenanceDatabase: string
  templateDatabase: string
  prefix: string
}

export type IsolatedDatabase = {
  sequelize: Sequelize
  drop: () => Promise<void>
}

export type FakeClock = Clock & {
  set: (date: Date) => void
  advance: (milliseconds: number) => void
}

export type MemoryMailer = Mailer & {
  messages: MailMessage[]
  failNext: () => void
  tokenSentTo: (email: string) => string
}

export type TestContextOptions = {
  now?: Date
  appOrigin?: string
  checkDatabase?: () => Promise<boolean>
  push?: PushSender
}

export type TestContext = {
  dependencies: AppDependencies
  server: Express
  clock: FakeClock
  mailer: MemoryMailer
  close: () => Promise<void>
}

export type TestClient = ReturnType<typeof createClient>

export type IsolationResources = {
  accountId: string
  paymentMethodId: string
  categoryId: string
  envelopeCategoryId: string
  operationId: string
  transferGroupId: string
  scheduleId: string
  envelopeId: string
  ruleId: string
  statementId: string
  importBatchId: string
  tagId: string
  investmentAccountId: string
  valuationId: string
  savingsAccountId: string
  interestRateId: string
  notificationId: string
  pushSubscriptionId: string
}

export type IsolationSnapshot = {
  notifications: unknown
  notificationPreferences: unknown
  pushDevices: unknown
  interest: unknown
  tags: unknown
  valuations: unknown
  rules: unknown
  statements: unknown
  imports: unknown
  overview: unknown
  paymentMethods: unknown
  categories: unknown
  operations: unknown
  schedules: unknown
  occurrences: unknown
  envelopes: unknown
}

export type IsolationActors = {
  context: TestContext
  alice: UserModel
  bob: UserModel
  aliceClient: TestClient
  bobClient: TestClient
  anonymous: TestClient
  bobResources: IsolationResources
  bobSnapshot: IsolationSnapshot
}

export type IsolationScenario = (actors: IsolationActors) => Promise<void>

export type DatabaseRejection = {
  code: string
  constraint: string | null
}

export type ExpenseScheduleRequest = Extract<
  CreateScheduleRequest,
  { kind: 'expense' }
>
