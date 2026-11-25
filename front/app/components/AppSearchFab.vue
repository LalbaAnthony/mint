<script setup lang="ts">
const { t } = useI18n()
const search = useSearchStore()
const hint = useShortcutHint('search', { fallbackOnly: true })
const { searchVisible } = useFloatingButtons()
</script>

<template>
  <OfflineGuard
    v-if="searchVisible"
    v-slot="{ offline }"
    :message="t('search.offline')"
  >
    <ShortcutTooltip :hint="hint" :text="t('search.open')">
      <UButton
        :icon="icons.search"
        :aria-label="t('search.open')"
        :disabled="offline"
        aria-haspopup="dialog"
        color="neutral"
        variant="soft"
        class="fixed right-4 bottom-[calc(64px+16px+56px+16px+env(safe-area-inset-bottom))] z-10 size-14 justify-center rounded-full shadow-lg lg:hidden"
        data-testid="search-fab"
        @click="search.openModal()"
      />
    </ShortcutTooltip>
  </OfflineGuard>
</template>
