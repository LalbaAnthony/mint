import { acquireAdvisoryLock } from '../execution/job.js'
import { describeError, log } from '../logger.js'
import type { HealthcheckPinger } from '../types/planning.js'
import type {
  NotificationContext,
  NotificationJobSummary,
} from '../types/notifications.js'
import { evaluateUserAlerts } from './evaluate.js'

export const notificationLockKey = 1_835_626_102

export const notificationCronExpression = '0 8 * * *'

export async function notifyUsers(
  context: NotificationContext,
): Promise<NotificationJobSummary> {
  const users = await context.models.User.findAll({
    attributes: ['id'],
    where: { status: 'active' },
  })
  const summary = { users: users.length, created: 0, pushed: 0, failures: 0 }
  for (const user of users) {
    try {
      const delivery = await evaluateUserAlerts(context, user.id, {
        reminders: true,
      })
      summary.created += delivery.created
      summary.pushed += delivery.pushed
    } catch (error) {
      summary.failures += 1
      log('error', 'user_notification_failed', {
        userId: user.id,
        error: describeError(error),
      })
    }
  }
  return summary
}

export async function runNotificationJob(
  context: NotificationContext,
  ping: HealthcheckPinger,
): Promise<'completed' | 'failed' | 'locked'> {
  return context.sequelize.transaction(async (lockTransaction) => {
    if (
      !(await acquireAdvisoryLock(
        context,
        notificationLockKey,
        lockTransaction,
      ))
    ) {
      log('info', 'notifications_skipped_locked')
      return 'locked'
    }
    await ping('start')
    try {
      const summary = await notifyUsers(context)
      log(
        summary.failures === 0 ? 'info' : 'error',
        'notifications_completed',
        summary,
      )
      await ping(summary.failures === 0 ? 'success' : 'fail')
      return summary.failures === 0 ? 'completed' : 'failed'
    } catch (error) {
      log('error', 'notifications_failed', { error: describeError(error) })
      await ping('fail')
      return 'failed'
    }
  })
}
