<script setup lang="ts">
import type { AppSearchTriggerProps } from '~~/types/search'

defineProps<AppSearchTriggerProps>()

const { t } = useI18n()
const search = useSearchStore()
</script>

<template>
  <OfflineGuard v-slot="{ offline }" block :message="t('search.offline')">
    <UTooltip v-if="collapsed" :text="t('search.open')">
      <UButton
        :icon="icons.search"
        :aria-label="t('search.open')"
        :disabled="offline"
        aria-haspopup="dialog"
        color="neutral"
        variant="soft"
        block
        data-testid="sidebar-search"
        @click="search.openModal()"
      />
    </UTooltip>
    <UFieldGroup v-else class="w-full" data-testid="sidebar-search">
      <UButton
        :label="t('search.placeholder')"
        :aria-label="t('search.open')"
        :disabled="offline"
        aria-haspopup="dialog"
        color="neutral"
        variant="outline"
        class="min-w-0 flex-1 justify-start font-normal text-muted"
        data-testid="sidebar-search-field"
        @click="search.openModal()"
      />
      <UButton
        :icon="icons.search"
        :disabled="offline"
        color="neutral"
        variant="soft"
        tabindex="-1"
        aria-hidden="true"
        data-testid="sidebar-search-button"
        @click="search.openModal()"
      />
    </UFieldGroup>
  </OfflineGuard>
</template>
