import type { Sequelize } from 'sequelize'
import type { AttemptLimiter } from './auth.js'
import type { Clock } from './clock.js'
import type { Mailer } from './mail.js'
import type { Models } from './models.js'
import type { AlertScheduler, PushSender } from './notifications.js'

export type HealthDependencies = {
  checkDatabase: () => Promise<boolean>
}

export type AppConfig = {
  appOrigin: string
  sessionSecret: string
}

export type AttemptLimiters = {
  account: AttemptLimiter
  ip: AttemptLimiter
}

export type AppDependencies = HealthDependencies & {
  config: AppConfig
  sequelize: Sequelize
  models: Models
  mailer: Mailer
  clock: Clock
  limiters: AttemptLimiters
  push: PushSender | null
  alerts: AlertScheduler
}
