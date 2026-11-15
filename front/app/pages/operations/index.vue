<script setup lang="ts">
import { useDebounceFn, useMediaQuery } from '@vueuse/core'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import type {
  Operation,
  OperationListResponse,
} from '@mint/shared/types/operations'
import type { OperationFilterState, OperationSorting } from '~~/types/planning'

const pageSize = 50

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()
const editor = useOperationEditorStore()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const route = useRoute()
const filters = ref<OperationFilterState>({
  ...emptyOperationFilters(),
  status: route.query.status === 'to_categorize' ? 'to_categorize' : undefined,
})
const sorting = ref<OperationSorting>({ sort: 'date', order: 'desc' })
const page = ref(1)
const result = ref<OperationListResponse | null>(null)
const filtersOpen = ref(false)
const busy = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function load(): Promise<void> {
  try {
    result.value = await apiGet(
      `/operations?${operationQuery(filters.value, sorting.value, page.value, pageSize)}`,
      operationListResponseSchema,
    )
  } catch (error) {
    notifyFailure(error)
  }
}

const reloadFromFirstPage = useDebounceFn(() => {
  if (page.value === 1) {
    return load()
  }
  page.value = 1
  return Promise.resolve()
}, 300)

watch([filters, sorting], () => void reloadFromFirstPage(), { deep: true })
watch(page, load)
watch(
  () => editor.savedVersion,
  async () => {
    await Promise.all([referentials.load(), load()])
  },
)

onMounted(async () => {
  try {
    await referentials.load()
  } catch (error) {
    notifyFailure(error)
  }
  await load()
})

const sortValue = computed({
  get: () => `${sorting.value.sort}:${sorting.value.order}`,
  set: (value: string) => {
    sorting.value =
      value === 'amount:desc'
        ? { sort: 'amount', order: 'desc' }
        : value === 'amount:asc'
          ? { sort: 'amount', order: 'asc' }
          : value === 'date:asc'
            ? { sort: 'date', order: 'asc' }
            : { sort: 'date', order: 'desc' }
  },
})

const sortItems = computed(() => [
  { label: t('operations.sort.dateDesc'), value: 'date:desc' },
  { label: t('operations.sort.dateAsc'), value: 'date:asc' },
  { label: t('operations.sort.amountDesc'), value: 'amount:desc' },
  { label: t('operations.sort.amountAsc'), value: 'amount:asc' },
])

const filterCount = computed(() => activeFilterCount(filters.value))

const items = computed(() => result.value?.items ?? [])

const columns = computed<TableColumn<Operation>[]>(() => [
  { accessorKey: 'date', header: t('operations.fields.date') },
  { accessorKey: 'label', header: t('operations.fields.label') },
  { accessorKey: 'accountId', header: t('operations.fields.account') },
  { accessorKey: 'amountCents', header: t('operations.fields.amount') },
  { id: 'actions', header: '' },
])

function detailOf(operation: Operation): string {
  if (operation.transferGroupId !== null) {
    return t('operations.transferWith', {
      account: referentials.accountName(operation.counterpartAccountId),
    })
  }
  return referentials.categoryName(operation.categoryId)
}

function actionsOf(operation: Operation): DropdownMenuItem[][] {
  return [
    [
      {
        label: t('common.edit'),
        icon: icons.edit,
        onSelect: () => editor.edit(operation),
      },
    ],
    [
      {
        label: t('common.delete'),
        icon: icons.delete,
        color: 'error',
        onSelect: () => {
          operationToDelete.value = operation
        },
      },
    ],
  ]
}

const operationToDelete = ref<Operation | null>(null)
const deleteOpen = computed({
  get: () => operationToDelete.value !== null,
  set: (open) => {
    if (!open) {
      operationToDelete.value = null
    }
  },
})

const deleteDescription = computed(() => {
  const operation = operationToDelete.value
  if (operation === null) {
    return ''
  }
  if (operation.transferGroupId !== null) {
    return t('operations.deleteTransferEffect', { label: operation.label })
  }
  return operation.origin === 'schedule'
    ? t('operations.deleteGeneratedEffect', { label: operation.label })
    : t('operations.deleteEffect', { label: operation.label })
})

async function deleteOperation(): Promise<void> {
  const operation = operationToDelete.value
  if (operation === null) {
    return
  }
  busy.value = true
  try {
    await apiCommand('DELETE', `/operations/${operation.id}`)
    operationToDelete.value = null
    toast.add({
      title: t('operations.deleted', { label: operation.label }),
      icon: icons.success,
      color: 'success',
    })
    await load()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ViewPanel :title="t('navigation.operations')">
    <template #actions>
      <UButton
        :icon="icons.add"
        :aria-label="t('operations.add')"
        color="primary"
        variant="soft"
        data-testid="operations-add"
        @click="editor.create('expense')"
      >
        <span class="max-sm:sr-only">{{ t('operations.add') }}</span>
      </UButton>
    </template>

    <div class="flex flex-col gap-4">
      <UCard>
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-end gap-2">
            <UInput
              v-model="filters.q"
              :icon="icons.search"
              :placeholder="t('operations.filters.search')"
              :aria-label="t('operations.filters.search')"
              class="min-w-48 flex-1"
              data-testid="operations-search"
            />
            <USelect
              v-model="sortValue"
              :items="sortItems"
              :aria-label="t('operations.sort.label')"
              class="w-48"
              data-testid="operations-sort"
            />
            <UButton
              :icon="icons.filter"
              :label="
                filterCount === 0
                  ? t('operations.filters.title')
                  : t('operations.filters.titleWithCount', { n: filterCount })
              "
              :aria-expanded="filtersOpen"
              color="neutral"
              variant="outline"
              data-testid="operations-filters-toggle"
              @click="filtersOpen = !filtersOpen"
            />
          </div>
          <OperationFilters
            v-if="filtersOpen"
            v-model="filters"
            :accounts="referentials.accounts"
            :categories="referentials.categories"
            :tags="referentials.tags"
          />
        </div>
      </UCard>

      <UCard v-if="result !== null" data-testid="operations-list">
        <EmptyState
          v-if="items.length === 0"
          :icon="icons.operations"
          :title="t('operations.emptyTitle')"
          :description="t('operations.emptyText')"
        >
          <UButton
            :label="t('operations.add')"
            :icon="icons.add"
            color="primary"
            variant="soft"
            @click="editor.create('expense')"
          />
        </EmptyState>
        <UTable
          v-else-if="isDesktop"
          :data="items"
          :columns="columns"
          data-testid="operations-table"
        >
          <template #date-cell="{ row }">
            <span class="tabular-nums">{{
              formatDate(row.original.date)
            }}</span>
          </template>
          <template #label-cell="{ row }">
            <div class="flex min-w-0 flex-col">
              <span class="flex items-center gap-1 text-default">
                <UIcon
                  :name="originIcon(row.original)"
                  class="size-4 shrink-0 text-muted"
                  :aria-label="t(`operations.origins.${row.original.origin}`)"
                />
                {{ row.original.label }}
                <OperationBadges :operation="row.original" />
              </span>
              <span class="text-xs text-muted">{{
                detailOf(row.original)
              }}</span>
              <TagBadges :tag-ids="row.original.tagIds" class="mt-1" />
            </div>
          </template>
          <template #accountId-cell="{ row }">
            {{ referentials.accountName(row.original.accountId) }}
          </template>
          <template #amountCents-cell="{ row }">
            <div class="text-right">
              <MoneyAmount :cents="row.original.amountCents" variant="flow" />
            </div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UDropdownMenu :items="actionsOf(row.original)">
                <UButton
                  :icon="icons.rowActions"
                  :aria-label="
                    t('common.actionsFor', { name: row.original.label })
                  "
                  color="neutral"
                  variant="ghost"
                />
              </UDropdownMenu>
            </div>
          </template>
        </UTable>
        <ul v-else class="flex flex-col divide-y divide-default">
          <OperationRow
            v-for="operation in items"
            :key="operation.id"
            :operation="operation"
            @edit="editor.edit"
            @delete="operationToDelete = $event"
          />
        </ul>
        <div v-if="result.total > pageSize" class="flex justify-center pt-4">
          <UPagination
            v-model:page="page"
            :total="result.total"
            :items-per-page="pageSize"
          />
        </div>
      </UCard>
    </div>

    <ConfirmModal
      v-model:open="deleteOpen"
      :title="t('operations.deleteTitle')"
      :description="deleteDescription"
      :confirm-label="t('common.delete')"
      :pending="busy"
      @confirm="deleteOperation"
    />
  </ViewPanel>
</template>
