<script setup lang="ts">
import type { SkeletonTextProps } from '~~/types/skeleton'

const props = withDefaults(defineProps<SkeletonTextProps>(), {
  width: 'md',
  lines: 1,
})

const lineIndexes = computed(() => skeletonIndexes(props.lines))

function widthOf(line: number): string {
  return props.lines > 1 && line === props.lines - 1
    ? 'w-2/3'
    : skeletonWidthClasses[props.width]
}
</script>

<template>
  <div aria-hidden="true">
    <div
      v-for="line in lineIndexes"
      :key="line"
      class="flex h-[1lh] items-center"
    >
      <SkeletonBlock
        shape="text"
        class="h-[0.75em] max-w-full"
        :class="widthOf(line)"
      />
    </div>
  </div>
</template>
