import {
  accountLimiterPolicy,
  createAttemptLimiter,
  ipLimiterPolicy,
} from './auth/attempt-limiter.js'
import { systemClock } from './clock.js'
import { createModels } from './db/models.js'
import { createSequelize, isDatabaseReachable } from './db/sequelize.js'
import { createSmtpMailer } from './mail/mailer.js'
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
  return {
    config: {
      appOrigin: environment.APP_ORIGIN,
      sessionSecret: environment.SESSION_SECRET,
    },
    sequelize,
    models: createModels(sequelize),
    mailer: createSmtpMailer(environment),
    clock: systemClock,
    limiters: createLimiters(systemClock),
    checkDatabase: () => isDatabaseReachable(sequelize),
  }
}
