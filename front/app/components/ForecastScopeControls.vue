<script setup lang="ts">
import type { SelectItem } from '~~/types/forms'

const accountId = defineModel<string | null>('accountId', { required: true })

const { t } = useI18n()
const referentials = useReferentialsStore()
const view = useForecastViewStore()

const aggregateValue = 'aggregate'

const accountItems = computed<SelectItem<string>[]>(() => [
  { label: t('forecast.allAccounts'), value: aggregateValue },
  ...referentials.activeAccounts.map((account) => ({
    label: account.name,
    value: account.id,
  })),
])

const selectedAccount = computed({
  get: () => accountId.value ?? aggregateValue,
  set: (value: string) => {
    accountId.value = value === aggregateValue ? null : value
  },
})

const horizonItems = computed<SelectItem<number>[]>(() =>
  Array.from({ length: 12 }, (_, index) => ({
    label: t('profile.monthCount', index + 1),
    value: index + 1,
  })),
)
</script>

<template>
  <div class="flex flex-wrap items-end gap-2">
    <UFormField :label="t('forecast.scope')" class="min-w-48 flex-1">
      <USelect
        v-model="selectedAccount"
        :items="accountItems"
        class="w-full"
        data-testid="forecast-account"
      />
    </UFormField>
    <UFormField :label="t('forecast.horizon')" class="w-32">
      <USelect
        v-model="view.horizonMonths"
        :items="horizonItems"
        class="w-full"
        data-testid="forecast-horizon"
      />
    </UFormField>
  </div>
</template>
