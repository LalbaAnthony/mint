import { UniqueConstraintError } from 'sequelize'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  notificationListResponseSchema,
  notificationPreferencesSchema,
  notificationSchema,
  pushDeviceListResponseSchema,
  pushDeviceSchema,
  pushKeyResponseSchema,
  pushSubscriptionRequestSchema,
  updateNotificationPreferencesRequestSchema,
} from '@mint/shared/schemas/notifications'
import type {
  Notification,
  NotificationPreferences,
  PushDevice,
} from '@mint/shared/types/notifications'
import { notFound } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import type { AppDependencies } from '../types/app.js'
import type {
  NotificationModel,
  PushSubscriptionModel,
} from '../types/models.js'

const tag = 'notifications'

const accessErrors = { 401: errorResponse('No valid session') }

const listLimit = 200

function toNotification(notification: NotificationModel): Notification {
  return notificationSchema.parse({
    id: notification.id,
    type: notification.type,
    payload: notification.payload,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  })
}

function toDevice(subscription: PushSubscriptionModel): PushDevice {
  return {
    id: subscription.id,
    endpoint: subscription.endpoint,
    userAgent: subscription.userAgent,
    lastSuccessAt: subscription.lastSuccessAt?.toISOString() ?? null,
    createdAt: subscription.createdAt.toISOString(),
  }
}

async function findUserNotification(
  app: AppDependencies,
  userId: string,
  id: string,
): Promise<NotificationModel> {
  const notification = await app.models.Notification.findOne({
    where: { id, userId },
  })
  if (notification === null) {
    throw notFound()
  }
  return notification
}

async function preferencesOf(
  app: AppDependencies,
  userId: string,
): Promise<NotificationPreferences> {
  const rows = await app.models.NotificationPreference.findAll({
    where: { userId },
  })
  const push = (type: 'low_balance' | 'manual_reminder') =>
    rows.find((row) => row.type === type)?.push ?? true
  return {
    lowBalancePush: push('low_balance'),
    manualReminderPush: push('manual_reminder'),
  }
}

export const listNotificationsRoute = defineUserRoute({
  method: 'get',
  path: '/notifications',
  summary:
    'In-app notifications, newest first, with the number of unread ones (NOTIF-04)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'Notifications',
      schema: notificationListResponseSchema,
    },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    const notifications = await app.models.Notification.findAll({
      where: { userId: user.id },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'ASC'],
      ],
      limit: listLimit,
    })
    const unreadCount = await app.models.Notification.count({
      where: { userId: user.id, readAt: null },
    })
    return {
      status: 200,
      body: { notifications: notifications.map(toNotification), unreadCount },
    }
  },
})

export const readNotificationRoute = defineUserRoute({
  method: 'post',
  path: '/notifications/:id/read',
  summary: 'Mark a notification as read (NOTIF-04)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Notification read', schema: notificationSchema },
    ...accessErrors,
    404: errorResponse('Unknown notification'),
  },
  handle: async ({ app, user, params }) => {
    const notification = await findUserNotification(app, user.id, params.id)
    if (notification.readAt === null) {
      await notification.update({ readAt: app.clock.now() })
    }
    return { status: 200, body: toNotification(notification) }
  },
})

export const readAllNotificationsRoute = defineUserRoute({
  method: 'post',
  path: '/notifications/read-all',
  summary: 'Mark every notification as read (NOTIF-04)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    204: { description: 'Notifications read' },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    await app.models.Notification.update(
      { readAt: app.clock.now() },
      { where: { userId: user.id, readAt: null } },
    )
    return { status: 204 }
  },
})

export const deleteNotificationRoute = defineUserRoute({
  method: 'delete',
  path: '/notifications/:id',
  summary: 'Delete a notification (NOTIF-04)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Notification deleted' },
    ...accessErrors,
    404: errorResponse('Unknown notification'),
  },
  handle: async ({ app, user, params }) => {
    const notification = await findUserNotification(app, user.id, params.id)
    await notification.destroy()
    return { status: 204 }
  },
})

export const getNotificationPreferencesRoute = defineUserRoute({
  method: 'get',
  path: '/notifications/preferences',
  summary:
    'Push channel of the low balance alerts and manual reminders; every notification always reaches the in-app center (NOTIF-03, NOTIF-05)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Preferences', schema: notificationPreferencesSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => ({
    status: 200,
    body: await preferencesOf(app, user.id),
  }),
})

export const updateNotificationPreferencesRoute = defineUserRoute({
  method: 'patch',
  path: '/notifications/preferences',
  summary: 'Switch the push channel per type (NOTIF-05)',
  tag,
  body: updateNotificationPreferencesRequestSchema,
  params: noParams,
  responses: {
    200: { description: 'Preferences', schema: notificationPreferencesSchema },
    400: errorResponse('Invalid body'),
    ...accessErrors,
  },
  handle: async ({ app, user, body }) => {
    const changes = [
      ['low_balance', body.lowBalancePush],
      ['manual_reminder', body.manualReminderPush],
    ] as const
    for (const [type, push] of changes) {
      if (push !== undefined) {
        await app.models.NotificationPreference.upsert({
          userId: user.id,
          type,
          push,
        })
      }
    }
    return { status: 200, body: await preferencesOf(app, user.id) }
  },
})

export const pushKeyRoute = defineUserRoute({
  method: 'get',
  path: '/push/key',
  summary:
    'Public VAPID key to subscribe this device, null when Web Push is not configured (NOTIF-03)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Public key', schema: pushKeyResponseSchema },
    ...accessErrors,
  },
  handle: ({ app }) => ({
    status: 200,
    body: { publicKey: app.push?.publicKey ?? null },
  }),
})

export const listPushDevicesRoute = defineUserRoute({
  method: 'get',
  path: '/push/subscriptions',
  summary: 'Devices subscribed to Web Push (NOTIF-03)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Devices', schema: pushDeviceListResponseSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    const subscriptions = await app.models.PushSubscription.findAll({
      where: { userId: user.id },
      order: [['createdAt', 'ASC']],
    })
    return { status: 200, body: subscriptions.map(toDevice) }
  },
})

export const subscribePushRoute = defineUserRoute({
  method: 'post',
  path: '/push/subscriptions',
  summary:
    'Subscribe this device to Web Push; an endpoint already known moves to the current user (NOTIF-03)',
  tag,
  body: pushSubscriptionRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Device subscribed', schema: pushDeviceSchema },
    400: errorResponse('Invalid body'),
    ...accessErrors,
  },
  handle: async ({ app, user, body, request }) => {
    const values = {
      userId: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      userAgent: request.get('user-agent')?.slice(0, 300) ?? null,
    }
    const existing = await app.models.PushSubscription.findOne({
      where: { endpoint: body.endpoint },
    })
    try {
      const subscription =
        existing === null
          ? await app.models.PushSubscription.create(values)
          : await existing.update({ ...values, lastSuccessAt: null })
      return { status: 201, body: toDevice(subscription) }
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        const raced = await app.models.PushSubscription.findOne({
          where: { endpoint: body.endpoint },
        })
        if (raced !== null) {
          await raced.update(values)
          return { status: 201, body: toDevice(raced) }
        }
      }
      throw error
    }
  },
})

export const unsubscribePushRoute = defineUserRoute({
  method: 'delete',
  path: '/push/subscriptions/:id',
  summary: 'Remove a device from Web Push (NOTIF-03)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Device removed' },
    ...accessErrors,
    404: errorResponse('Unknown device'),
  },
  handle: async ({ app, user, params }) => {
    const subscription = await app.models.PushSubscription.findOne({
      where: { id: params.id, userId: user.id },
    })
    if (subscription === null) {
      throw notFound()
    }
    await subscription.destroy()
    return { status: 204 }
  },
})
