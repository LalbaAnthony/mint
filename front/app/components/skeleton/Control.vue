<script setup lang="ts">
import type { SkeletonControlProps } from '~~/types/skeleton'

withDefaults(defineProps<SkeletonControlProps>(), { size: 'md' })
</script>

<template>
  <div
    v-if="kind === 'checkbox'"
    class="flex shrink-0 items-center"
    :class="size === 'md' ? 'h-5' : 'h-4'"
    aria-hidden="true"
  >
    <SkeletonBlock
      :shape="skeletonControlShapes[kind]"
      :class="skeletonControlClasses[kind][size]"
    />
  </div>
  <SkeletonBlock
    v-else
    :shape="skeletonControlShapes[kind]"
    class="shrink-0"
    :class="skeletonControlClasses[kind][size]"
  />
</template>
