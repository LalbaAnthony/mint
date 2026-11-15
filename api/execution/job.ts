import { QueryTypes } from 'sequelize'
import { parisDate } from '../clock.js'
import { describeError, log } from '../logger.js'
import { lockRowsSchema } from '../schemas/planning.js'
import type { Clock } from '../types/clock.js'
import type {
  DataAccess,
  ExecutionJobOutcome,
  HealthcheckPinger,
  HealthcheckSignal,
} from '../types/planning.js'
import { executeDueOccurrences } from './execute.js'

export const executionLockKey = 1_835_626_100

export const executionCronExpression = '5 0 * * *'

const pingTimeoutMilliseconds = 10_000

export function createHealthcheckPinger(
  url: string | undefined,
  send: typeof fetch = fetch,
): HealthcheckPinger {
  const suffixes: Record<HealthcheckSignal, string> = {
    start: '/start',
    success: '',
    fail: '/fail',
  }
  return async (signal) => {
    if (url === undefined) {
      return
    }
    try {
      const response = await send(`${url}${suffixes[signal]}`, {
        signal: AbortSignal.timeout(pingTimeoutMilliseconds),
      })
      if (!response.ok) {
        log('warn', 'healthcheck_ping_rejected', {
          signal,
          status: response.status,
        })
      }
    } catch (error) {
      log('warn', 'healthcheck_ping_failed', {
        signal,
        error: describeError(error),
      })
    }
  }
}

export async function runExecutionJob(
  data: DataAccess,
  clock: Clock,
  ping: HealthcheckPinger,
): Promise<ExecutionJobOutcome> {
  return data.sequelize.transaction(async (lockTransaction) => {
    const rows = await data.sequelize.query(
      'SELECT pg_try_advisory_xact_lock(:key) AS locked',
      {
        replacements: { key: executionLockKey },
        type: QueryTypes.SELECT,
        transaction: lockTransaction,
      },
    )
    if (lockRowsSchema.parse(rows)[0]?.locked !== true) {
      log('info', 'execution_skipped_locked')
      return 'locked'
    }
    await ping('start')
    try {
      const today = parisDate(clock.now())
      const summary = await executeDueOccurrences(data, today)
      log(summary.failures === 0 ? 'info' : 'error', 'execution_completed', {
        today,
        ...summary,
      })
      await ping(summary.failures === 0 ? 'success' : 'fail')
      return summary.failures === 0 ? 'completed' : 'failed'
    } catch (error) {
      log('error', 'execution_failed', { error: describeError(error) })
      await ping('fail')
      return 'failed'
    }
  })
}
