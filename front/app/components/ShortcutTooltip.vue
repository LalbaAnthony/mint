<script setup lang="ts">
import type { ShortcutTooltipProps } from '~~/types/shortcuts'

const props = defineProps<ShortcutTooltipProps>()

const staticHint = useShortcutHint(() => props.shortcut)
const resolvedHint = computed(() => props.hint ?? staticHint.value)
</script>

<template>
  <UTooltip
    :text="text"
    :kbds="resolvedHint?.kbds"
    :disabled="resolvedHint === undefined"
    :aria-keyshortcuts="resolvedHint?.ariaKeyshortcuts"
  >
    <slot />
  </UTooltip>
</template>
