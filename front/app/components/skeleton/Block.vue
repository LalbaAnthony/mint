<script setup lang="ts">
import type { SkeletonBlockProps } from '~~/types/skeleton'

withDefaults(defineProps<SkeletonBlockProps>(), { shape: 'control' })
</script>

<template>
  <div
    class="bg-elevated motion-safe:animate-pulse"
    :class="skeletonShapeClasses[shape]"
    aria-hidden="true"
    data-skeleton
  />
</template>
