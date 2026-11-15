import {
  accountLimiterPolicy,
  createAttemptLimiter,
  ipLimiterPolicy,
} from './auth/attempt-limiter.js'
import { systemClock } from './clock.js'
import { createModels } from './db/models.js'
import { createSequelize, isDatabaseReachable } from './db/sequelize.js'
import { createSmtpMailer } from './mail/mailer.js'
import { evaluateUserAlerts } from './notifications/evaluate.js'
import { createWebPushSender, vapidSettings } from './notifications/push.js'
import { createAlertScheduler } from './notifications/scheduler.js'
import type { AppDependencies, AttemptLimiters } from './types/app.js'
import type { Clock } from './types/clock.js'
import type { ServerEnvironment } from './types/environment.js'

export function createLimiters(clock: Clock): AttemptLimiters {
  const now = () => clock.now().getTime()
  return {
    account: createAttemptLimiter({ ...accountLimiterPolicy, now }),
    ip: createAttemptLimiter({ ...ipLimiterPolicy, now }),
  }
}

export function createDependencies(
  environment: ServerEnvironment,
): AppDependencies {
  const sequelize = createSequelize(environment)
  const models = createModels(sequelize)
  const vapid = vapidSettings(environment)
  const push = vapid === null ? null : createWebPushSender(vapid)
  return {
    config: {
      appOrigin: environment.APP_ORIGIN,
      sessionSecret: environment.SESSION_SECRET,
    },
    sequelize,
    models,
    mailer: createSmtpMailer(environment),
    clock: systemClock,
    limiters: createLimiters(systemClock),
    push,
    alerts: createAlertScheduler(async (userId) => {
      await evaluateUserAlerts(
        { sequelize, models, clock: systemClock, push },
        userId,
        { reminders: false },
      )
    }),
    checkDatabase: () => isDatabaseReachable(sequelize),
  }
}
