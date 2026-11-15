<script setup lang="ts">
import type { InvestmentGainProps } from '~~/types/valuations'

const props = defineProps<InvestmentGainProps>()

const { t, locale } = useI18n()

const gainCents = computed(() => props.summary.latentGainCents)

const ratio = computed(() => {
  const gain = gainCents.value
  return gain === null || props.summary.paidInCents <= 0
    ? null
    : gain / props.summary.paidInCents
})

const percent = computed(() =>
  ratio.value === null
    ? null
    : new Intl.NumberFormat(locale.value, {
        style: 'percent',
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: 'exceptZero',
      }).format(ratio.value),
)
</script>

<template>
  <span
    v-if="gainCents !== null"
    class="inline-flex items-center gap-1 text-xs whitespace-nowrap"
    :aria-label="t('valuations.gainLabel')"
    data-testid="investment-gain"
  >
    <MoneyAmount :cents="gainCents" variant="flow" />
    <span
      v-if="percent !== null"
      class="tabular-nums"
      :class="gainCents > 0 ? 'text-success' : 'text-default'"
      data-testid="investment-gain-percent"
      >({{ percent }})</span
    >
  </span>
</template>
