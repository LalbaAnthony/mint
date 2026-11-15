import { notificationLink } from '@mint/shared/engines/notifications'
import type { Notification } from '@mint/shared/types/notifications'
import type { NotificationView } from '~~/types/notifications'

export function useNotificationViews() {
  const { t } = useI18n()
  const { formatDate, formatMoney } = useFormatters()

  function texts(notification: Notification): { title: string; body: string } {
    switch (notification.type) {
      case 'low_balance':
        return {
          title: t('notifications.lowBalance.title', {
            account: notification.payload.accountName,
          }),
          body: t('notifications.lowBalance.body', {
            amount: formatMoney(notification.payload.minCents),
            date: formatDate(notification.payload.minDate),
            threshold: formatMoney(notification.payload.thresholdCents),
          }),
        }
      case 'manual_reminder':
        return {
          title: t('notifications.reminder.title', {
            label: notification.payload.scheduleLabel,
          }),
          body: notification.payload.dueToday
            ? t('notifications.reminder.today', {
                amount: formatMoney(notification.payload.amountCents),
              })
            : t('notifications.reminder.ahead', {
                amount: formatMoney(notification.payload.amountCents),
                date: formatDate(notification.payload.effectiveDate),
              }),
        }
      case 'deposit_cap':
        return {
          title: t('notifications.depositCap.title', {
            account: notification.payload.accountName,
          }),
          body: t('notifications.depositCap.body', {
            amount: formatMoney(notification.payload.excessCents),
            date: formatDate(notification.payload.date),
          }),
        }
    }
  }

  function viewOf(notification: Notification): NotificationView {
    return {
      notification,
      ...texts(notification),
      link: notificationLink(notification),
      tone: notification.type === 'manual_reminder' ? 'reminder' : 'warning',
      unread: notification.readAt === null,
    }
  }

  return { viewOf }
}
