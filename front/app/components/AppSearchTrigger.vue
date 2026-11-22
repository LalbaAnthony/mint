<script setup lang="ts">
import type { AppSearchTriggerProps } from '~~/types/search'

defineProps<AppSearchTriggerProps>()

const { t } = useI18n()
const search = useSearchStore()
const hint = useShortcutHint('search', { fallbackOnly: true })
</script>

<template>
  <OfflineGuard v-slot="{ offline }" block :message="t('search.offline')">
    <UTooltip
      v-if="collapsed"
      :text="t('search.open')"
      :kbds="hint?.kbds"
      :aria-keyshortcuts="hint?.ariaKeyshortcuts"
    >
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
    <div v-else class="relative w-full" data-testid="sidebar-search">
      <UFieldGroup class="w-full">
        <UButton
          :label="t('search.placeholder')"
          :aria-label="t('search.open')"
          :aria-keyshortcuts="hint?.ariaKeyshortcuts"
          :disabled="offline"
          aria-haspopup="dialog"
          color="neutral"
          variant="outline"
          :class="[
            'min-w-0 flex-1 justify-start font-normal text-muted',
            { 'pe-14': hint !== undefined },
          ]"
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
      <span
        v-if="hint !== undefined"
        class="pointer-events-none absolute inset-y-0 end-10 flex items-center gap-0.5"
        aria-hidden="true"
        data-testid="sidebar-search-kbds"
      >
        <UKbd v-for="(kbd, index) in hint.kbds" :key="index" :value="kbd" />
      </span>
    </div>
  </OfflineGuard>
</template>
