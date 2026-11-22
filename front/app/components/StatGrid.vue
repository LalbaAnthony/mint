<script setup lang="ts">
import type { StatGridProps } from '~~/types/skeleton'

defineProps<StatGridProps>()
</script>

<template>
  <div class="grid grid-cols-1 gap-4" :class="statGridColumnClasses[columns]">
    <slot />
  </div>
</template>
