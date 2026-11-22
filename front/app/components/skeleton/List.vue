<script setup lang="ts">
import type { SkeletonListProps } from '~~/types/skeleton'

const props = withDefaults(defineProps<SkeletonListProps>(), {
  count: skeletonRowCount,
  row: () => ({}),
  ordered: false,
})

const rows = computed(() => skeletonIndexes(props.count))
</script>

<template>
  <component :is="ordered ? 'ol' : 'ul'" aria-hidden="true">
    <ListRow v-for="index in rows" :key="index" v-bind="row">
      <slot :index="index" />
    </ListRow>
  </component>
</template>
