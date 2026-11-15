import type { z } from 'zod'
import type {
  depositCapPayloadSchema,
  lowBalancePayloadSchema,
  manualReminderPayloadSchema,
  notificationListResponseSchema,
  notificationPreferencesSchema,
  notificationSchema,
  notificationTypeSchema,
  pushDeviceListResponseSchema,
  pushDeviceSchema,
  pushKeyResponseSchema,
  pushMessageSchema,
  pushSubscriptionRequestSchema,
  updateNotificationPreferencesRequestSchema,
} from '../schemas/notifications.js'

export type NotificationType = z.infer<typeof notificationTypeSchema>

export type LowBalancePayload = z.infer<typeof lowBalancePayloadSchema>

export type ManualReminderPayload = z.infer<typeof manualReminderPayloadSchema>

export type DepositCapPayload = z.infer<typeof depositCapPayloadSchema>

export type Notification = z.infer<typeof notificationSchema>

export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>

export type NotificationPreferences = z.infer<
  typeof notificationPreferencesSchema
>

export type UpdateNotificationPreferencesRequest = z.infer<
  typeof updateNotificationPreferencesRequestSchema
>

export type PushKeyResponse = z.infer<typeof pushKeyResponseSchema>

export type PushMessage = z.infer<typeof pushMessageSchema>

export type PushSubscriptionRequest = z.infer<
  typeof pushSubscriptionRequestSchema
>

export type PushDevice = z.infer<typeof pushDeviceSchema>

export type PushDeviceListResponse = z.infer<
  typeof pushDeviceListResponseSchema
>

export type NotificationContent =
  | { type: 'low_balance'; payload: LowBalancePayload }
  | { type: 'manual_reminder'; payload: ManualReminderPayload }
  | { type: 'deposit_cap'; payload: DepositCapPayload }

export type NotificationDraft = NotificationContent & { dedupKey: string }

export type LowBalanceWindow = {
  accountId: string
  thresholdCents: number
  below: boolean
  minCents: number
  minDate: string
}

export type AlertEpisodeState = {
  id: string
  minCents: number
  minDate: string
  lastNotifiedMinCents: number
}

export type EpisodeDecision =
  | { action: 'none' }
  | { action: 'close' }
  | { action: 'open'; notify: true }
  | { action: 'update'; notify: boolean }

export type ReminderOccurrence = {
  scheduleId: string
  originalDate: string
  effectiveDate: string
  amountCents: number
  status: 'pending' | 'skipped' | 'executed'
  matched: boolean
}

export type DueReminder = {
  scheduleId: string
  originalDate: string
  effectiveDate: string
  amountCents: number
  dueToday: boolean
}
