<script setup lang="ts">
import type { MoneyAmountProps } from '~~/types/components'
import type { MoneyState } from '~~/types/referentials'

const props = withDefaults(defineProps<MoneyAmountProps>(), {
  variant: 'balance',
  threshold: null,
})

const { t } = useI18n()
const { formatMoney } = useFormatters()

const stateClasses = {
  normal: 'text-highlighted',
  belowThreshold: 'text-warning',
  negative: 'text-error',
  credit: 'text-success',
  debit: 'text-default',
} as const satisfies Record<MoneyState, string>

const state = computed<MoneyState>(() => {
  if (props.variant === 'flow') {
    return props.cents > 0 ? 'credit' : 'debit'
  }
  if (props.cents < 0) {
    return 'negative'
  }
  if (props.threshold !== null && props.cents < props.threshold) {
    return 'belowThreshold'
  }
  return 'normal'
})

const icon = computed(() => {
  switch (state.value) {
    case 'belowThreshold':
      return icons.belowThreshold
    case 'negative':
      return icons.negative
    default:
      return null
  }
})

const text = computed(() =>
  formatMoney(props.cents, props.variant === 'flow' ? 'exceptZero' : 'auto'),
)
</script>

<template>
  <span
    class="inline-flex items-center gap-1 whitespace-nowrap tabular-nums"
    :class="stateClasses[state]"
    :data-state="state"
    data-testid="money-amount"
  >
    <UIcon
      v-if="icon !== null"
      :name="icon"
      class="size-4 shrink-0"
      aria-hidden="true"
    />
    <span v-if="state === 'belowThreshold'" class="sr-only">
      {{ t('money.belowThreshold') }}
    </span>
    <span>{{ text }}</span>
  </span>
</template>
