import webpush from 'web-push'
import { describeError, log } from '../logger.js'
import type { PushMessage } from '@mint/shared/types/notifications'
import type {
  PushOutcome,
  PushSender,
  PushTarget,
  VapidSettings,
} from '../types/notifications.js'

const pushTimeToLiveSeconds = 24 * 60 * 60

export function vapidSettings(environment: {
  VAPID_PUBLIC_KEY?: string | undefined
  VAPID_PRIVATE_KEY?: string | undefined
  VAPID_SUBJECT?: string | undefined
}): VapidSettings | null {
  const publicKey = environment.VAPID_PUBLIC_KEY
  const privateKey = environment.VAPID_PRIVATE_KEY
  const subject = environment.VAPID_SUBJECT
  return publicKey === undefined ||
    privateKey === undefined ||
    subject === undefined
    ? null
    : { publicKey, privateKey, subject }
}

export function createWebPushSender(settings: VapidSettings): PushSender {
  return {
    publicKey: settings.publicKey,
    async send(target: PushTarget, message: PushMessage): Promise<PushOutcome> {
      try {
        await webpush.sendNotification(
          {
            endpoint: target.endpoint,
            keys: { p256dh: target.p256dh, auth: target.auth },
          },
          JSON.stringify(message),
          {
            TTL: pushTimeToLiveSeconds,
            vapidDetails: {
              subject: settings.subject,
              publicKey: settings.publicKey,
              privateKey: settings.privateKey,
            },
          },
        )
        return 'sent'
      } catch (error) {
        if (
          error instanceof webpush.WebPushError &&
          (error.statusCode === 404 || error.statusCode === 410)
        ) {
          return 'gone'
        }
        log('warn', 'push_failed', { error: describeError(error) })
        return 'failed'
      }
    },
  }
}
