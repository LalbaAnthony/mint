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

export const linkedTargetAttribute = 'data-linked-target'

export const linkedHighlightClass = 'rounded-md ring-2 ring-inset ring-primary'

export const linkedRowHighlightClass =
  'outline-2 -outline-offset-2 outline-primary'

export function linkedTargetAttributes(
  isTarget: boolean,
): Record<string, string> {
  return isTarget ? { [linkedTargetAttribute]: '' } : {}
}

export function safeRedirect(target: unknown): string {
  return typeof target === 'string' &&
    target.startsWith('/') &&
    !target.startsWith('//')
    ? target
    : '/'
}
