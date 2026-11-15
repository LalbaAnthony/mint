import cron from 'node-cron'
import { systemClock } from './clock.js'
import { createModels } from './db/models.js'
import { createSequelize } from './db/sequelize.js'
import { parseEnvironment } from './environment.js'
import {
  createHealthcheckPinger,
  executionCronExpression,
  runExecutionJob,
} from './execution/job.js'
import { describeError, log } from './logger.js'
import { purgeCronExpression, runPurgeJob } from './maintenance/purge.js'
import {
  notificationCronExpression,
  runNotificationJob,
} from './notifications/job.js'
import { createWebPushSender, vapidSettings } from './notifications/push.js'
import { workerEnvironmentSchema } from './schemas/environment.js'

function loadEnvironment() {
  try {
    return parseEnvironment(workerEnvironmentSchema, process.env)
  } catch (error) {
    log('error', 'worker_environment_invalid', { error: describeError(error) })
    process.exit(1)
  }
}

const environment = loadEnvironment()
const sequelize = createSequelize(environment)
const data = { sequelize, models: createModels(sequelize) }
const executionPing = createHealthcheckPinger(
  environment.HEALTHCHECK_EXECUTION_URL,
)
const purgePing = createHealthcheckPinger(environment.HEALTHCHECK_PURGE_URL)
const notificationPing = createHealthcheckPinger(
  environment.HEALTHCHECK_NOTIFICATIONS_URL,
)
const vapid = vapidSettings(environment)
const notificationContext = {
  ...data,
  clock: systemClock,
  push: vapid === null ? null : createWebPushSender(vapid),
}

async function runExecution(): Promise<void> {
  try {
    await runExecutionJob(data, systemClock, executionPing)
  } catch (error) {
    log('error', 'execution_failed', { error: describeError(error) })
  }
}

async function runNotifications(): Promise<void> {
  try {
    await runNotificationJob(notificationContext, notificationPing)
  } catch (error) {
    log('error', 'notifications_failed', { error: describeError(error) })
  }
}

async function runPurge(): Promise<void> {
  try {
    await runPurgeJob(data, systemClock, purgePing)
  } catch (error) {
    log('error', 'purge_failed', { error: describeError(error) })
  }
}

log('info', 'worker_started', {
  execution: executionCronExpression,
  purge: purgeCronExpression,
  notifications: notificationCronExpression,
})
await runExecution()
await runNotifications()

const tasks = [
  cron.schedule(executionCronExpression, runExecution, {
    name: 'execution',
    timezone: 'Europe/Paris',
    noOverlap: true,
  }),
  cron.schedule(purgeCronExpression, runPurge, {
    name: 'purge',
    timezone: 'Europe/Paris',
    noOverlap: true,
  }),
  cron.schedule(notificationCronExpression, runNotifications, {
    name: 'notifications',
    timezone: 'Europe/Paris',
    noOverlap: true,
  }),
]

async function shutDown(signal: NodeJS.Signals): Promise<void> {
  log('info', 'worker_stopping', { signal })
  try {
    await Promise.all(tasks.map((task) => task.stop()))
    await sequelize.close()
    log('info', 'worker_stopped')
  } catch (error) {
    log('error', 'worker_stop_failed', { error: describeError(error) })
    process.exitCode = 1
  }
}

process.once('SIGTERM', (signal) => void shutDown(signal))
process.once('SIGINT', (signal) => void shutDown(signal))
