<script setup lang="ts">
import type { ListRowProps } from '~~/types/skeleton'

const props = withDefaults(defineProps<ListRowProps>(), {
  as: 'li',
  gap: 2,
  padding: 2,
  flush: false,
  inset: false,
  align: undefined,
  direction: 'row',
  wrap: false,
  spread: false,
})

const classes = computed(() => [
  listRowGapClasses[props.gap],
  listRowPaddingClasses[props.padding],
  listRowDirectionClasses[props.direction],
  listRowAlignClasses[
    props.align ?? (props.direction === 'row' ? 'center' : 'stretch')
  ],
  props.flush ? 'first:pt-0 last:pb-0' : '',
  props.inset ? 'px-4 sm:px-6' : '',
  props.wrap ? 'flex-wrap' : '',
  props.spread ? 'justify-between' : '',
  props.as === 'button' ? 'w-full text-left' : '',
])
</script>

<template>
  <component
    :is="as"
    :type="as === 'button' ? 'button' : undefined"
    class="flex"
    :class="classes"
  >
    <slot />
  </component>
</template>
