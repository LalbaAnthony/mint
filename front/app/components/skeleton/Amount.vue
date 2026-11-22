<script setup lang="ts">
import type { SkeletonAmountProps } from '~~/types/skeleton'

const props = withDefaults(defineProps<SkeletonAmountProps>(), {
  concealable: false,
})

const mask = useAmountMask()

const widthClass = computed(() =>
  props.concealable && mask.masked.value
    ? skeletonAmountWidthClasses.masked
    : skeletonAmountWidthClasses.shown,
)
</script>

<template>
  <span
    class="inline-flex max-w-full items-center whitespace-nowrap"
    aria-hidden="true"
    data-testid="skeleton-amount"
  >
    <span class="w-0 overflow-hidden">&nbsp;</span>
    <SkeletonBlock
      shape="text"
      class="h-[0.75em] min-w-0"
      :class="widthClass"
    />
  </span>
</template>
