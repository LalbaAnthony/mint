<script setup lang="ts">
import type { NotificationView } from '~~/types/notifications'

const store = useNotificationsStore()
const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDateTime } = useFormatters()
const { viewOf } = useNotificationViews()

const views = computed(() => store.notifications.map(viewOf))
const markingAll = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function openView(view: NotificationView): Promise<void> {
  try {
    if (view.unread) {
      await store.markRead(view.notification.id)
    }
    store.open = false
    await navigateTo(view.link)
  } catch (error) {
    notifyFailure(error)
  }
}

async function markAllRead(): Promise<void> {
  markingAll.value = true
  try {
    await store.markAllRead()
  } catch (error) {
    notifyFailure(error)
  } finally {
    markingAll.value = false
  }
}

async function remove(view: NotificationView): Promise<void> {
  try {
    await store.remove(view.notification.id)
  } catch (error) {
    notifyFailure(error)
  }
}
</script>

<template>
  <USlideover
    v-model:open="store.open"
    :title="t('notifications.title')"
    :description="
      t(
        'notifications.unreadSummary',
        { n: store.unreadCount },
        store.unreadCount,
      )
    "
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="notification-center">
        <div v-if="store.unreadCount > 0" class="flex justify-end">
          <UButton
            :label="t('notifications.markAllRead')"
            :loading="markingAll"
            color="primary"
            variant="soft"
            data-testid="notifications-read-all"
            @click="markAllRead"
          />
        </div>
        <EmptyState
          v-if="views.length === 0"
          :icon="icons.notifications"
          :title="t('notifications.emptyTitle')"
          :description="t('notifications.emptyDescription')"
        />
        <ul v-else class="flex flex-col divide-y divide-default">
          <li
            v-for="view in views"
            :key="view.notification.id"
            class="flex items-start gap-3 py-3"
            :data-testid="`notification-${view.notification.id}`"
          >
            <PlanningMarker
              v-if="view.tone === 'reminder'"
              kind="manual"
              class="mt-0.5"
            />
            <UIcon
              v-else
              :name="icons.belowThreshold"
              class="mt-0.5 size-5 shrink-0 text-warning"
              aria-hidden="true"
            />
            <button
              type="button"
              class="flex min-w-0 flex-1 flex-col gap-1 rounded-md text-left focus-visible:outline-2 focus-visible:outline-primary"
              :data-testid="`notification-open-${view.notification.id}`"
              @click="openView(view)"
            >
              <span class="flex items-center gap-2">
                <span
                  v-if="view.unread"
                  class="size-2 shrink-0 rounded-full bg-accent-fill"
                  data-testid="notification-unread-dot"
                />
                <span
                  class="text-sm"
                  :class="
                    view.unread
                      ? 'font-semibold text-highlighted'
                      : 'font-normal text-toned'
                  "
                  data-testid="notification-title"
                >
                  {{ view.title }}
                </span>
                <span v-if="view.unread" class="sr-only">
                  {{ t('notifications.unread') }}
                </span>
              </span>
              <span class="text-sm text-muted">{{ view.body }}</span>
              <span class="text-xs text-muted tabular-nums">
                {{ formatDateTime(view.notification.createdAt) }}
              </span>
            </button>
            <UButton
              :icon="icons.delete"
              :aria-label="t('notifications.delete', { title: view.title })"
              :class="touchIconButtonClass"
              color="neutral"
              variant="ghost"
              :data-testid="`notification-delete-${view.notification.id}`"
              @click="remove(view)"
            />
          </li>
        </ul>
      </div>
    </template>
  </USlideover>
</template>
