<script setup lang="ts">
const model = defineModel<string>({ required: true })

const { t, locale } = useI18n()

function normalize(): void {
  const rate = parseRateInput(model.value, locale.value)
  if (rate === null) {
    return
  }
  const formatted = formatRateInput(rate, locale.value)
  const lossless = parseRateInput(formatted, locale.value) === rate
  if (lossless && formatted !== model.value) {
    model.value = formatted
  }
}
</script>

<template>
  <UInput
    v-model="model"
    inputmode="decimal"
    class="w-full"
    :ui="{ base: 'tabular-nums' }"
    @blur="normalize"
  >
    <template #trailing>
      <span class="text-sm text-muted">{{ t('percent.symbol') }}</span>
    </template>
  </UInput>
</template>
