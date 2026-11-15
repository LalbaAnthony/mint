import type { Notification } from '@mint/shared/types/notifications'

export type PushSupport = 'unsupported' | 'ios-install' | 'available'

export type NotificationTone = 'warning' | 'reminder'

export type NotificationView = {
  notification: Notification
  title: string
  body: string
  link: string
  tone: NotificationTone
  unread: boolean
}

export type CalendarDeepLink = {
  accountId: string | null
  day: string
}

export type ApiMutationListener = (path: string) => void
