<script setup lang="ts">
import type { ConcealedTextProps } from '~~/types/components'

defineProps<ConcealedTextProps>()
</script>

<template>
  <template v-if="text === spokenText">{{ text }}</template>
  <template v-else>
    <span aria-hidden="true">{{ text }}</span>
    <span class="sr-only">{{ spokenText }}</span>
  </template>
</template>
