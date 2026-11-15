import { describeError, log } from '../logger.js'
import type { AlertScheduler } from '../types/notifications.js'

export function createAlertScheduler(
  evaluate: (userId: string) => Promise<void>,
): AlertScheduler {
  const running = new Map<string, Promise<void>>()
  const again = new Set<string>()

  function start(userId: string): void {
    const run = (async () => {
      try {
        await evaluate(userId)
      } catch (error) {
        log('error', 'alert_evaluation_failed', {
          userId,
          error: describeError(error),
        })
      } finally {
        running.delete(userId)
        if (again.delete(userId)) {
          start(userId)
        }
      }
    })()
    running.set(userId, run)
  }

  return {
    schedule(userId) {
      if (running.has(userId)) {
        again.add(userId)
        return
      }
      start(userId)
    },
    async idle() {
      while (running.size > 0) {
        await Promise.all(running.values())
      }
    },
  }
}
