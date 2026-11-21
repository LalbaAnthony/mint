<script setup lang="ts">
import type { CapExcessBadgeProps } from '~~/types/components'

const props = withDefaults(defineProps<CapExcessBadgeProps>(), {
  concealable: false,
})

const { t } = useI18n()
const { formatMoney } = useFormatters()
const mask = useAmountMask()

const concealed = computed(() => props.concealable && mask.masked.value)

const label = computed(() =>
  t('caps.exceeds', {
    amount: concealed.value
      ? mask.maskedText(props.excessCents)
      : formatMoney(props.excessCents),
  }),
)

const spokenLabel = computed(() =>
  concealed.value
    ? t('caps.exceeds', { amount: mask.maskedSpeech(props.excessCents) })
    : label.value,
)
</script>

<template>
  <UBadge
    :icon="icons.belowThreshold"
    color="warning"
    variant="soft"
    size="sm"
    class="tabular-nums"
    :data-masked="concealed"
    data-testid="cap-excess"
  >
    <template #default="{ ui }">
      <span data-slot="label" :class="ui.label()">
        <ConcealedText :text="label" :spoken-text="spokenLabel" />
      </span>
    </template>
  </UBadge>
</template>
