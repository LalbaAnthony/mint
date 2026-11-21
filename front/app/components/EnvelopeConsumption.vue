<script setup lang="ts">
import type { EnvelopeConsumptionProps } from '~~/types/planning'

const props = defineProps<EnvelopeConsumptionProps>()

const { t } = useI18n()
const { money, spokenMoney } = useAmountMask()

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
          consumed: spokenMoney(status.consumedCents),
          budget: spokenMoney(allowance),
        })
      "
      :data-tone="tone"
      data-testid="envelope-progress"
    />
    <div class="flex flex-wrap items-baseline justify-between gap-x-2 text-sm">
      <span class="tabular-nums text-default" data-testid="envelope-consumed">
        <ConcealedText
          :text="
            t('envelopes.consumedOfBudget', {
              consumed: money(status.consumedCents),
              budget: money(allowance),
            })
          "
          :spoken-text="
            t('envelopes.consumedOfBudget', {
              consumed: spokenMoney(status.consumedCents),
              budget: spokenMoney(allowance),
            })
          "
        />
      </span>
      <span
        v-if="overrun > 0"
        class="tabular-nums text-error"
        data-testid="envelope-overrun"
      >
        <ConcealedText
          :text="t('envelopes.overrun', { amount: money(overrun) })"
          :spoken-text="
            t('envelopes.overrun', { amount: spokenMoney(overrun) })
          "
        />
      </span>
    </div>
  </div>
</template>
