<script setup lang="ts">
import type { AmountInputProps } from '~~/types/components'

const props = defineProps<AmountInputProps>()
const model = defineModel<string>({ required: true })

const { t, locale } = useI18n()

const placeholder = computed(
  () => props.placeholder ?? amountInputPlaceholder(locale.value),
)

function normalize(): void {
  const cents = parseAmountInput(model.value, locale.value)
  if (cents === null) {
    return
  }
  const formatted = formatAmountInput(cents, locale.value)
  if (formatted !== model.value) {
    model.value = formatted
  }
}
</script>

<template>
  <UInput
    v-model="model"
    inputmode="decimal"
    :placeholder="placeholder"
    class="w-full"
    :ui="{ base: 'tabular-nums' }"
    @blur="normalize"
  >
    <template #trailing>
      <span class="text-sm text-muted">{{ t('money.symbol') }}</span>
    </template>
  </UInput>
</template>
