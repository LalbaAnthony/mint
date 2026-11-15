import type { LocationQuery } from 'vue-router'
import { isoDateSchema } from '@mint/shared/schemas/common'
import type { CalendarDeepLink } from '~~/types/notifications'

export function readHashToken(hash: string): string | null {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token')
}

export function calendarDeepLink(
  query: LocationQuery,
): CalendarDeepLink | null {
  const { account, day } = query
  if (typeof day !== 'string' || !isoDateSchema.safeParse(day).success) {
    return null
  }
  return { accountId: typeof account === 'string' ? account : null, day }
}

export function safeRedirect(target: unknown): string {
  return typeof target === 'string' &&
    target.startsWith('/') &&
    !target.startsWith('//')
    ? target
    : '/'
}
