<script setup lang="ts">
import type { SearchSectionCardProps } from '~~/types/search'

defineProps<SearchSectionCardProps>()

const { t } = useI18n()
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    :data-testid="`search-section-${section}`"
  >
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        {{
          t('search.sectionCount', {
            section: t(`navigation.${section}`),
            n: total,
          })
        }}
      </h2>
    </template>
    <ul class="divide-y divide-default">
      <slot />
    </ul>
    <slot name="footer" />
  </UCard>
</template>
