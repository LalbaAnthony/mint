<script setup lang="ts">
import type { EnvelopeRowSkeletonProps } from '~~/types/skeleton'

defineProps<EnvelopeRowSkeletonProps>()

const { t } = useI18n()

const amountLabels = computed(() => [
  t('envelopes.budget'),
  t('envelopes.carriedOver'),
  t('envelopes.available'),
  t('envelopes.perRemainingDay'),
])
</script>

<template>
  <ListRow direction="column" :padding="3">
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <SkeletonText :width="skeletonRowWidth(index)" class="text-sm" />
        <SkeletonText width="md" class="text-xs" />
      </div>
      <SkeletonControl kind="icon-button" class="size-11" />
    </div>
    <SkeletonProgress />
    <dl class="grid grid-cols-2 gap-2 text-sm">
      <div v-for="label in amountLabels" :key="label">
        <dt class="text-xs font-medium text-muted">{{ label }}</dt>
        <dd><SkeletonAmount concealable /></dd>
      </div>
    </dl>
  </ListRow>
</template>
