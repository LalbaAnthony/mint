<script setup lang="ts">
import type { EmptyStateProps } from '~~/types/components'

defineProps<EmptyStateProps>()
</script>

<template>
  <div class="flex flex-col items-center gap-3 px-4 py-8 text-center">
    <span
      class="flex size-16 items-center justify-center rounded-full bg-accent-tile"
    >
      <UIcon :name="icon" class="size-8 text-accent-tile-icon" />
    </span>
    <h3 class="text-base font-semibold text-highlighted">{{ title }}</h3>
    <p class="text-sm text-muted">{{ description }}</p>
    <slot />
  </div>
</template>
