<script setup lang="ts">
import type { StatTileProps } from '~~/types/skeleton'

const props = withDefaults(defineProps<StatTileProps>(), {
  emphasis: 'secondary',
  icon: undefined,
})

const valueClass = computed(() => statTileValueClasses[props.emphasis])
</script>

<template>
  <UCard>
    <div v-if="icon !== undefined" class="flex items-center gap-3">
      <span
        class="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-tile"
      >
        <UIcon :name="icon" class="size-5 text-accent-tile-icon" />
      </span>
      <div class="min-w-0">
        <p class="text-sm font-medium text-muted">{{ label }}</p>
        <slot :value-class="valueClass" />
      </div>
    </div>
    <template v-else>
      <p class="text-sm font-medium text-muted">{{ label }}</p>
      <slot :value-class="valueClass" />
    </template>
  </UCard>
</template>
