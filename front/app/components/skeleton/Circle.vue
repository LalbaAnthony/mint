<script setup lang="ts">
import type { SkeletonCircleProps } from '~~/types/skeleton'

defineProps<SkeletonCircleProps>()
</script>

<template>
  <SkeletonBlock
    shape="round"
    class="shrink-0"
    :class="skeletonCircleClasses[size]"
  />
</template>
