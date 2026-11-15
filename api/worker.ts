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
const ping = createHealthcheckPinger(environment.HEALTHCHECK_EXECUTION_URL)

async function runExecution(): Promise<void> {
  try {
    await runExecutionJob(data, systemClock, ping)
  } catch (error) {
    log('error', 'execution_failed', { error: describeError(error) })
  }
}

log('info', 'worker_started', { execution: executionCronExpression })
await runExecution()

const task = cron.schedule(executionCronExpression, runExecution, {
  name: 'execution',
  timezone: 'Europe/Paris',
  noOverlap: true,
})

async function shutDown(signal: NodeJS.Signals): Promise<void> {
  log('info', 'worker_stopping', { signal })
  try {
    await task.stop()
    await sequelize.close()
    log('info', 'worker_stopped')
  } catch (error) {
    log('error', 'worker_stop_failed', { error: describeError(error) })
    process.exitCode = 1
  }
}

process.once('SIGTERM', (signal) => void shutDown(signal))
process.once('SIGINT', (signal) => void shutDown(signal))
