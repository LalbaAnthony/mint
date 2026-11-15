import { notificationListResponseSchema } from '@mint/shared/schemas/notifications'
import type { Notification } from '@mint/shared/types/notifications'

export const useNotificationsStore = defineStore('notifications', () => {
  const notifications = ref<Notification[]>([])
  const unreadCount = ref(0)
  const open = ref(false)

  async function refresh(): Promise<void> {
    const response = await apiGet(
      '/notifications',
      notificationListResponseSchema,
    )
    notifications.value = response.notifications
    unreadCount.value = response.unreadCount
  }

  async function markRead(id: string): Promise<void> {
    await apiCommand('POST', `/notifications/${id}/read`)
    await refresh()
  }

  async function markAllRead(): Promise<void> {
    await apiCommand('POST', '/notifications/read-all')
    await refresh()
  }

  async function remove(id: string): Promise<void> {
    await apiCommand('DELETE', `/notifications/${id}`)
    await refresh()
  }

  function reset(): void {
    notifications.value = []
    unreadCount.value = 0
    open.value = false
  }

  return {
    notifications,
    unreadCount,
    open,
    refresh,
    markRead,
    markAllRead,
    remove,
    reset,
  }
})
