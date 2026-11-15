import type { PushMessage } from '@mint/shared/types/notifications'
import type { Locale } from '@mint/shared/types/user'
import type { Clock } from './clock.js'
import type { DataAccess } from './planning.js'

export type PushTarget = {
  endpoint: string
  p256dh: string
  auth: string
}

export type PushOutcome = 'sent' | 'gone' | 'failed'

export type PushSender = {
  publicKey: string
  send: (target: PushTarget, message: PushMessage) => Promise<PushOutcome>
}

export type VapidSettings = {
  publicKey: string
  privateKey: string
  subject: string
}

export type AlertScheduler = {
  schedule: (userId: string) => void
  idle: () => Promise<void>
}

export type NotificationContext = DataAccess & {
  clock: Clock
  push: PushSender | null
}

export type EvaluationOptions = {
  reminders: boolean
}

export type AlertDelivery = {
  created: number
  pushed: number
}

export type NotificationJobSummary = {
  users: number
  created: number
  pushed: number
  failures: number
}

export type MessageFormatters = {
  locale: Locale
  money: (cents: number) => string
  date: (isoDate: string) => string
}
