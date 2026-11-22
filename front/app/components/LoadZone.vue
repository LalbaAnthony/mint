<script setup lang="ts">
import type { LoadZoneProps } from '~~/types/skeleton'

defineOptions({ inheritAttrs: false })

const props = defineProps<LoadZoneProps>()

function retry(): void {
  void props.state.retry()
}
</script>

<template>
  <SkeletonZone
    v-if="state.phase === 'pending' || state.phase === 'skeleton'"
    v-bind="$attrs"
    :class="state.phase === 'pending' ? 'invisible' : ''"
  >
    <slot name="skeleton" />
  </SkeletonZone>
  <slot v-else-if="state.phase === 'error'" name="error" :retry="retry">
    <LoadError @retry="retry" />
  </slot>
  <slot v-else-if="state.phase === 'ready'" />
</template>
