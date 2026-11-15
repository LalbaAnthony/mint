<script setup lang="ts">
import type { PlanningMarkerProps } from '~~/types/planning'

const props = defineProps<PlanningMarkerProps>()

const { t } = useI18n()

const icon = computed(() =>
  props.kind === 'manual' ? icons.manualMode : icons.subscription,
)
</script>

<template>
  <span
    class="inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-fill"
    role="img"
    :aria-label="t(`schedules.markers.${kind}`)"
    :title="t(`schedules.markers.${kind}`)"
  >
    <UIcon :name="icon" class="size-3 text-accent-on-fill" aria-hidden="true" />
  </span>
</template>
