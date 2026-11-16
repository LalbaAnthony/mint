<script setup lang="ts">
import type { EnvelopeConsumptionProps } from '~~/types/planning'

const props = defineProps<EnvelopeConsumptionProps>()

const { t } = useI18n()
const { formatMoney } = useFormatters()

const allowance = computed(
  () => props.status.budgetCents + props.status.carriedOverCents,
)
const tone = computed(() =>
  envelopeTone(props.status.consumedCents, allowance.value),
)
const progress = computed(() =>
  envelopeProgress(props.status.consumedCents, allowance.value),
)
const overrun = computed(() =>
  Math.max(0, props.status.consumedCents - allowance.value),
)
</script>

<template>
  <div class="flex min-w-32 flex-col gap-1">
    <UProgress
      :model-value="progress"
      :color="tone"
      size="md"
      :aria-label="
        t('envelopes.progressLabel', {
          consumed: formatMoney(status.consumedCents),
          budget: formatMoney(allowance),
        })
      "
      :data-tone="tone"
      data-testid="envelope-progress"
    />
    <div class="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
      <span class="tabular-nums text-default" data-testid="envelope-consumed">
        {{
          t('envelopes.consumedOfBudget', {
            consumed: formatMoney(status.consumedCents),
            budget: formatMoney(allowance),
          })
        }}
      </span>
      <span
        v-if="overrun > 0"
        class="tabular-nums text-error"
        data-testid="envelope-overrun"
      >
        {{ t('envelopes.overrun', { amount: formatMoney(overrun) }) }}
      </span>
    </div>
  </div>
</template>
