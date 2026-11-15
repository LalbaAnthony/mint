import { z } from 'zod'
import { scheduleKindSchema } from './schedules.js'

export const notificationTypes = [
  'low_balance',
  'manual_reminder',
  'deposit_cap',
] as const

export const pushNotificationTypes = ['low_balance', 'manual_reminder'] as const

export const notificationTypeSchema = z
  .enum(notificationTypes)
  .meta({ id: 'NotificationType' })

export const lowBalancePayloadSchema = z.object({
  accountId: z.uuid(),
  accountName: z.string(),
  minDate: z.iso.date(),
  minCents: z.number().int(),
  thresholdCents: z.number().int(),
})

export const manualReminderPayloadSchema = z.object({
  scheduleId: z.uuid(),
  scheduleLabel: z.string(),
  kind: scheduleKindSchema,
  accountId: z.uuid(),
  originalDate: z.iso.date(),
  effectiveDate: z.iso.date(),
  amountCents: z.number().int(),
  dueToday: z.boolean(),
})

export const depositCapPayloadSchema = z.object({
  accountId: z.uuid(),
  accountName: z.string(),
  scheduleId: z.uuid().nullable(),
  scheduleLabel: z.string().nullable(),
  originalDate: z.iso.date().nullable(),
  date: z.iso.date(),
  excessCents: z.number().int(),
})

export const notificationSchema = z
  .discriminatedUnion('type', [
    z.object({
      id: z.uuid(),
      type: z.literal('low_balance'),
      payload: lowBalancePayloadSchema,
      readAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
    }),
    z.object({
      id: z.uuid(),
      type: z.literal('manual_reminder'),
      payload: manualReminderPayloadSchema,
      readAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
    }),
    z.object({
      id: z.uuid(),
      type: z.literal('deposit_cap'),
      payload: depositCapPayloadSchema,
      readAt: z.iso.datetime().nullable(),
      createdAt: z.iso.datetime(),
    }),
  ])
  .meta({ id: 'Notification' })

export const notificationListResponseSchema = z
  .object({
    notifications: z.array(notificationSchema),
    unreadCount: z.number().int(),
  })
  .meta({ id: 'NotificationListResponse' })

export const notificationPreferencesSchema = z
  .object({
    lowBalancePush: z.boolean({ error: 'invalid' }),
    manualReminderPush: z.boolean({ error: 'invalid' }),
  })
  .meta({ id: 'NotificationPreferences' })

export const updateNotificationPreferencesRequestSchema =
  notificationPreferencesSchema
    .partial()
    .meta({ id: 'UpdateNotificationPreferencesRequest' })

export const pushMessageSchema = z
  .object({
    title: z.string(),
    body: z.string(),
    url: z.string().startsWith('/'),
    tag: z.string(),
  })
  .meta({ id: 'PushMessage' })

export const pushKeyResponseSchema = z
  .object({ publicKey: z.string().nullable() })
  .meta({ id: 'PushKeyResponse' })

export const pushSubscriptionRequestSchema = z
  .object({
    endpoint: z
      .url({ protocol: /^https$/, error: 'invalid' })
      .max(2_000, { error: 'too_long' }),
    keys: z.object({
      p256dh: z.string().min(1).max(200, { error: 'too_long' }),
      auth: z.string().min(1).max(100, { error: 'too_long' }),
    }),
  })
  .meta({ id: 'PushSubscriptionRequest' })

export const pushDeviceSchema = z
  .object({
    id: z.uuid(),
    endpoint: z.string(),
    userAgent: z.string().nullable(),
    lastSuccessAt: z.iso.datetime().nullable(),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'PushDevice' })

export const pushDeviceListResponseSchema = z
  .array(pushDeviceSchema)
  .meta({ id: 'PushDeviceListResponse' })
