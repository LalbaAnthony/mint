<script setup lang="ts">
import type { DataDotProps } from '~~/types/components'
import type { DataTone } from '~~/types/referentials'

defineProps<DataDotProps>()

const toneClasses = {
  current: 'bg-data-current',
  emergency: 'bg-data-emergency',
  savings: 'bg-data-savings',
  investment: 'bg-data-investment',
  needs: 'bg-data-needs',
  wants: 'bg-data-wants',
  save: 'bg-data-save',
} as const satisfies Record<DataTone, string>
</script>

<template>
  <span
    class="inline-block size-2.5 shrink-0 rounded-full"
    :class="toneClasses[tone]"
    aria-hidden="true"
  />
</template>
