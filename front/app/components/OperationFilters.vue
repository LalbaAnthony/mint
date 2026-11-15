<script setup lang="ts">
import { operationGroups } from '@mint/shared/schemas/operations'
import {
  transactionOrigins,
  transactionStatuses,
} from '@mint/shared/schemas/transactions'
import type {
  OperationDirection,
  OperationGroup,
} from '@mint/shared/types/operations'
import type {
  TransactionOrigin,
  TransactionStatus,
} from '@mint/shared/types/transactions'
import type { SelectItem } from '~~/types/forms'
import type {
  OperationFilterState,
  OperationFiltersProps,
} from '~~/types/planning'

const props = defineProps<OperationFiltersProps>()
const filters = defineModel<OperationFilterState>({ required: true })

const { t } = useI18n()

const anyValue = 'any'

const accountItems = computed<SelectItem<string>[]>(() =>
  props.accounts.map((account) => ({ label: account.name, value: account.id })),
)

const groupItems = computed<SelectItem<OperationGroup>[]>(() =>
  operationGroups.map((group) => ({
    label: t(`groups.${group}`),
    value: group,
  })),
)

const categoryItems = computed<SelectItem<string>[]>(() =>
  categoryOptionGroups(
    props.categories,
    ['expense', 'income'],
    undefined,
    (kind) => t(`categories.kinds.${kind}`),
  ).flatMap((group) => group.options),
)

const originItems = computed<SelectItem<TransactionOrigin>[]>(() =>
  transactionOrigins.map((origin) => ({
    label: t(`operations.origins.${origin}`),
    value: origin,
  })),
)

const directionItems = computed(() => [
  { label: t('operations.filters.anyDirection'), value: anyValue },
  { label: t('operations.directions.debit'), value: 'debit' },
  { label: t('operations.directions.credit'), value: 'credit' },
])

const statusItems = computed(() => [
  { label: t('operations.filters.anyStatus'), value: anyValue },
  ...transactionStatuses.map((status) => ({
    label: t(`operations.statuses.${status}`),
    value: status,
  })),
])

function isDirection(value: string): value is OperationDirection {
  return value === 'debit' || value === 'credit'
}

function isStatus(value: string): value is TransactionStatus {
  return value === 'categorized' || value === 'to_categorize'
}

const directionModel = computed({
  get: () => filters.value.direction ?? anyValue,
  set: (value: string) => {
    filters.value.direction = isDirection(value) ? value : undefined
  },
})

const statusModel = computed({
  get: () => filters.value.status ?? anyValue,
  set: (value: string) => {
    filters.value.status = isStatus(value) ? value : undefined
  },
})

const reconciledItems = computed(() => [
  { label: t('operations.filters.anyReconciliation'), value: anyValue },
  { label: t('operations.filters.reconciledOnly'), value: 'true' },
  { label: t('operations.filters.notReconciled'), value: 'false' },
])

const reconciledModel = computed({
  get: () =>
    filters.value.reconciled === undefined
      ? anyValue
      : String(filters.value.reconciled),
  set: (value: string) => {
    filters.value.reconciled =
      value === 'true' ? true : value === 'false' ? false : undefined
  },
})

function reset(): void {
  filters.value = emptyOperationFilters()
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="operation-filters">
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <AppFormField :label="t('operations.filters.from')" name="from">
        <UInput v-model="filters.from" type="date" class="w-full" />
      </AppFormField>
      <AppFormField :label="t('operations.filters.to')" name="to">
        <UInput v-model="filters.to" type="date" class="w-full" />
      </AppFormField>
      <AppFormField :label="t('operations.filters.minAmount')" name="minAmount">
        <UInput
          v-model="filters.minAmount"
          inputmode="decimal"
          class="w-full"
          :ui="{ base: 'text-right tabular-nums' }"
        />
      </AppFormField>
      <AppFormField :label="t('operations.filters.maxAmount')" name="maxAmount">
        <UInput
          v-model="filters.maxAmount"
          inputmode="decimal"
          class="w-full"
          :ui="{ base: 'text-right tabular-nums' }"
        />
      </AppFormField>
      <AppFormField :label="t('operations.filters.accounts')" name="accountIds">
        <USelectMenu
          v-model="filters.accountIds"
          :items="accountItems"
          value-key="value"
          multiple
          class="w-full"
          data-testid="filter-accounts"
        />
      </AppFormField>
      <AppFormField :label="t('operations.filters.groups')" name="groups">
        <USelectMenu
          v-model="filters.groups"
          :items="groupItems"
          value-key="value"
          multiple
          class="w-full"
        />
      </AppFormField>
      <AppFormField
        :label="t('operations.filters.categories')"
        name="categoryIds"
      >
        <USelectMenu
          v-model="filters.categoryIds"
          :items="categoryItems"
          value-key="value"
          multiple
          class="w-full"
        />
      </AppFormField>
      <AppFormField :label="t('operations.filters.origins')" name="origins">
        <USelectMenu
          v-model="filters.origins"
          :items="originItems"
          value-key="value"
          multiple
          class="w-full"
        />
      </AppFormField>
      <AppFormField :label="t('operations.filters.direction')" name="direction">
        <USelect
          v-model="directionModel"
          :items="directionItems"
          class="w-full"
          data-testid="filter-direction"
        />
      </AppFormField>
      <AppFormField :label="t('operations.filters.status')" name="status">
        <USelect v-model="statusModel" :items="statusItems" class="w-full" />
      </AppFormField>
      <AppFormField
        :label="t('operations.filters.reconciliation')"
        name="reconciled"
      >
        <USelect
          v-model="reconciledModel"
          :items="reconciledItems"
          class="w-full"
          data-testid="filter-reconciled"
        />
      </AppFormField>
      <USwitch
        v-model="filters.unconfirmed"
        :label="t('operations.filters.unconfirmedOnly')"
        class="self-end"
        data-testid="filter-unconfirmed"
      />
    </div>
    <div class="flex justify-end">
      <UButton
        :label="t('operations.filters.reset')"
        color="neutral"
        variant="ghost"
        @click="reset"
      />
    </div>
  </div>
</template>
