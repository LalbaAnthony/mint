import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { acquireAdvisoryLock } from '../execution/job.js'
import { describeError, log } from '../logger.js'
import type { Clock } from '../types/clock.js'
import type {
  DataAccess,
  ExecutionJobOutcome,
  HealthcheckPinger,
} from '../types/planning.js'
import type { PurgeSummary } from '../types/maintenance.js'

export const purgeLockKey = 1_835_626_101

export const purgeCronExpression = '0 3 * * *'

export async function purgeExpiredRecords(
  data: DataAccess,
  now: Date,
  transaction?: Transaction,
): Promise<PurgeSummary> {
  const spentToken = {
    [Op.or]: [{ expiresAt: { [Op.lte]: now } }, { usedAt: { [Op.ne]: null } }],
  }
  return {
    sessions: await data.models.Session.destroy({
      where: { expiresAt: { [Op.lte]: now } },
      transaction,
    }),
    passwordResetTokens: await data.models.PasswordResetToken.destroy({
      where: spentToken,
      transaction,
    }),
    emailChangeTokens: await data.models.EmailChangeToken.destroy({
      where: spentToken,
      transaction,
    }),
  }
}

export async function runPurgeJob(
  data: DataAccess,
  clock: Clock,
  ping: HealthcheckPinger,
): Promise<ExecutionJobOutcome> {
  return data.sequelize.transaction(async (lockTransaction) => {
    if (!(await acquireAdvisoryLock(data, purgeLockKey, lockTransaction))) {
      log('info', 'purge_skipped_locked')
      return 'locked'
    }
    await ping('start')
    try {
      const summary = await purgeExpiredRecords(
        data,
        clock.now(),
        lockTransaction,
      )
      log('info', 'purge_completed', summary)
      await ping('success')
      return 'completed'
    } catch (error) {
      log('error', 'purge_failed', { error: describeError(error) })
      await ping('fail')
      return 'failed'
    }
  })
}
