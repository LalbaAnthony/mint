import { pushMessageSchema } from '@mint/shared/schemas/notifications'
import type { PushDisplay } from '../types/service-worker'

export const pushIcon = '/pwa-192x192.png'
export const pushBadge = '/badge-96x96.png'
export const notificationsChangedMessage = 'mint:notifications-changed'

export function displayOfPush(data: unknown): PushDisplay | null {
  const parsed = pushMessageSchema.safeParse(data)
  if (!parsed.success) {
    return null
  }
  return {
    title: parsed.data.title,
    options: {
      body: parsed.data.body,
      icon: pushIcon,
      badge: pushBadge,
      tag: parsed.data.tag,
      data: { url: parsed.data.url },
    },
  }
}

export function clickTarget(data: unknown, origin: string): string {
  const url =
    typeof data === 'object' &&
    data !== null &&
    'url' in data &&
    typeof data.url === 'string' &&
    data.url.startsWith('/')
      ? data.url
      : '/'
  return new URL(url, origin).href
}
