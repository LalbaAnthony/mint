<script setup lang="ts">
const maxDisplayedCount = 99

const store = useNotificationsStore()
const { t } = useI18n()
const hint = useShortcutHint('notifications')

const counter = computed(() =>
  store.unreadCount > maxDisplayedCount
    ? `${maxDisplayedCount}+`
    : String(store.unreadCount),
)

const label = computed(() =>
  t('notifications.bell', { n: store.unreadCount }, store.unreadCount),
)
</script>

<template>
  <ShortcutTooltip :hint="hint" :text="label">
    <UButton
      color="neutral"
      variant="ghost"
      square
      :class="['relative', touchIconButtonClass]"
      :aria-label="label"
      data-testid="notification-bell"
      @click="store.open = true"
    >
      <UIcon :name="icons.notifications" class="size-5" aria-hidden="true" />
      <span
        v-if="store.unreadCount > 0"
        class="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-fill px-1 text-xs font-semibold text-accent-on-fill tabular-nums"
        aria-hidden="true"
        data-testid="notification-counter"
      >
        {{ counter }}
      </span>
    </UButton>
  </ShortcutTooltip>
</template>
