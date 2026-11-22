<script setup lang="ts">
import type { SkeletonChartProps } from '~~/types/skeleton'

const props = defineProps<SkeletonChartProps>()

const height = useChartHeight(props.height)
</script>

<template>
  <SkeletonBlock class="w-full" :style="{ height }" />
</template>
