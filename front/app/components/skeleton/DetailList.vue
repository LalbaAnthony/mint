<script setup lang="ts">
import type { SkeletonDetailListProps } from '~~/types/skeleton'

withDefaults(defineProps<SkeletonDetailListProps>(), {
  leading: false,
  actions: 'button',
  row: () => ({}),
  count: skeletonRowCount,
})
</script>

<template>
  <SkeletonList :row="row" :count="count">
    <template #default="{ index }">
      <SkeletonCircle v-if="leading" :size="16" />
      <div class="min-w-0 flex-1">
        <SkeletonText :width="skeletonRowWidth(index)" class="text-sm" />
        <SkeletonText width="md" class="text-xs" />
      </div>
      <SkeletonControl
        v-if="actions !== 'none'"
        :kind="actions === 'touch' ? 'touch-icon-button' : 'icon-button'"
      />
    </template>
  </SkeletonList>
</template>
