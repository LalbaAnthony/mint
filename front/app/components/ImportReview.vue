<script setup lang="ts">
import type { ImportRow } from '@mint/shared/types/imports'
import type { SelectItem } from '~~/types/forms'
import type {
  ImportReviewEmits,
  ImportReviewProps,
  ReviewFilter,
  RowDecisionState,
} from '~~/types/imports'

const props = defineProps<ImportReviewProps>()
const emit = defineEmits<ImportReviewEmits>()

const { t } = useI18n()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()

const pageSize = 50
const noReconciliation = 'none'
const noCategory = 'none'

function keyOf(scheduleId: string, originalDate: string): string {
  return `${scheduleId}|${originalDate}`
}

function initialDecision(row: ImportRow): RowDecisionState {
  const [best] = row.candidates
  return {
    include: !row.duplicate,
    categoryId: row.categoryId,
    transferAccountId: row.categoryId === null ? row.transferAccountId : null,
    reconcileKey:
      best === undefined ? null : keyOf(best.scheduleId, best.originalDate),
  }
}

const decisions = ref(
  new Map(
    props.rows
      .filter((row) => row.error === null)
      .map((row) => [row.rowIndex, initialDecision(row)]),
  ),
)

const filter = ref<ReviewFilter>('all')
const page = ref(1)

const counts = computed(() => ({
  valid: props.rows.filter((row) => row.error === null).length,
  errors: props.rows.filter((row) => row.error !== null).length,
  duplicates: props.rows.filter((row) => row.duplicate).length,
  proposals: props.rows.filter((row) => row.candidates.length > 0).length,
}))

function decisionOf(row: ImportRow): RowDecisionState {
  return decisions.value.get(row.rowIndex) ?? initialDecision(row)
}

function update(row: ImportRow, changes: Partial<RowDecisionState>): void {
  decisions.value.set(row.rowIndex, { ...decisionOf(row), ...changes })
  decisions.value = new Map(decisions.value)
}

function matches(row: ImportRow): boolean {
  switch (filter.value) {
    case 'all':
      return row.error === null
    case 'toCategorize': {
      const decision = decisionOf(row)
      return (
        row.error === null &&
        decision.categoryId === null &&
        decision.transferAccountId === null &&
        decision.reconcileKey === null
      )
    }
    case 'proposals':
      return row.candidates.length > 0
    case 'duplicates':
      return row.duplicate
    case 'errors':
      return row.error !== null
  }
}

const filtered = computed(() => props.rows.filter(matches))
const visible = computed(() =>
  filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize),
)

watch(filter, () => {
  page.value = 1
})

const filterItems = computed<SelectItem<ReviewFilter>[]>(() => [
  { label: t('imports.filters.all', { n: counts.value.valid }), value: 'all' },
  { label: t('imports.filters.toCategorize'), value: 'toCategorize' },
  {
    label: t('imports.filters.proposals', { n: counts.value.proposals }),
    value: 'proposals',
  },
  {
    label: t('imports.filters.duplicates', { n: counts.value.duplicates }),
    value: 'duplicates',
  },
  {
    label: t('imports.filters.errors', { n: counts.value.errors }),
    value: 'errors',
  },
])

const categoryItems = computed(() => [
  { label: t('operations.noCategory'), value: noCategory },
  ...categoryOptionGroups(
    referentials.categories,
    ['expense', 'income'],
    undefined,
    (kind) => t(`categories.kinds.${kind}`),
  ).flatMap((group) => group.options),
])

function categoryModel(row: ImportRow): string {
  return decisionOf(row).categoryId ?? noCategory
}

function setCategory(row: ImportRow, value: string): void {
  update(row, {
    categoryId: value === noCategory ? null : value,
    transferAccountId: null,
  })
}

function reconcileItems(row: ImportRow) {
  return [
    { label: t('imports.noReconciliation'), value: noReconciliation },
    ...row.candidates.map((candidate) => ({
      label: `${candidate.scheduleLabel} · ${formatDate(candidate.effectiveDate)}`,
      value: keyOf(candidate.scheduleId, candidate.originalDate),
    })),
  ]
}

function reconcileModel(row: ImportRow): string {
  return decisionOf(row).reconcileKey ?? noReconciliation
}

function setReconcile(row: ImportRow, value: string): void {
  update(row, { reconcileKey: value === noReconciliation ? null : value })
}

function acceptAllProposals(): void {
  for (const row of props.rows) {
    const [best] = row.candidates
    if (best !== undefined) {
      update(row, { reconcileKey: keyOf(best.scheduleId, best.originalDate) })
    }
  }
}

function refuseAllProposals(): void {
  for (const row of props.rows) {
    if (row.candidates.length > 0) {
      update(row, { reconcileKey: null })
    }
  }
}

function errorLabel(row: ImportRow): string {
  return row.error === null ? '' : t(`imports.errors.${row.error}`)
}
</script>

<template>
  <div class="flex flex-col gap-4" data-testid="import-review">
    <div class="flex flex-wrap items-end gap-2">
      <USelect
        v-model="filter"
        :items="filterItems"
        :aria-label="t('imports.filters.label')"
        class="w-64"
        data-testid="import-filter"
      />
      <UButton
        :label="t('imports.acceptProposals')"
        color="neutral"
        variant="outline"
        :disabled="counts.proposals === 0"
        @click="acceptAllProposals"
      />
      <UButton
        :label="t('imports.refuseProposals')"
        color="neutral"
        variant="outline"
        :disabled="counts.proposals === 0"
        @click="refuseAllProposals"
      />
    </div>
    <ul class="flex flex-col divide-y divide-default">
      <li
        v-for="row in visible"
        :key="row.rowIndex"
        class="flex flex-col gap-2 py-2 lg:flex-row lg:items-center"
        :data-testid="`import-row-${row.rowIndex}`"
      >
        <UCheckbox
          v-if="row.error === null"
          :model-value="decisionOf(row).include"
          :aria-label="t('imports.include', { label: row.bankLabel ?? '' })"
          :data-testid="`import-include-${row.rowIndex}`"
          @update:model-value="
            (value) => update(row, { include: value === true })
          "
        />
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-2 truncate text-sm text-default">
            <span class="tabular-nums text-muted">
              {{ row.date === null ? '' : formatDate(row.date) }}
            </span>
            <span class="truncate">
              {{ row.bankLabel ?? row.raw.join(' ; ') }}
            </span>
            <UBadge
              v-if="row.duplicate"
              :label="t('imports.duplicate')"
              color="neutral"
              variant="soft"
              size="sm"
            />
            <UBadge
              v-if="row.error !== null"
              :label="errorLabel(row)"
              :icon="icons.error"
              color="error"
              variant="soft"
              size="sm"
              data-testid="import-error"
            />
          </p>
          <p
            v-if="decisionOf(row).transferAccountId !== null"
            class="text-xs text-muted"
          >
            {{
              t('operations.transferWith', {
                account: referentials.accountName(
                  decisionOf(row).transferAccountId,
                ),
              })
            }}
          </p>
          <TagBadges :tag-ids="row.tagIds" class="mt-1" />
        </div>
        <template v-if="row.error === null && decisionOf(row).include">
          <USelect
            v-if="row.candidates.length > 0"
            :model-value="reconcileModel(row)"
            :items="reconcileItems(row)"
            :aria-label="t('imports.reconcileWith')"
            class="w-full lg:w-64"
            :data-testid="`import-reconcile-${row.rowIndex}`"
            @update:model-value="(value) => setReconcile(row, String(value))"
          />
          <USelect
            v-if="decisionOf(row).reconcileKey === null"
            :model-value="categoryModel(row)"
            :items="categoryItems"
            :aria-label="t('operations.fields.category')"
            class="w-full lg:w-56"
            :data-testid="`import-category-${row.rowIndex}`"
            @update:model-value="(value) => setCategory(row, String(value))"
          />
        </template>
        <MoneyAmount
          v-if="row.amountCents !== null"
          :cents="row.amountCents"
          variant="flow"
          class="text-sm lg:w-28 lg:justify-end"
        />
      </li>
    </ul>
    <UPagination
      v-if="filtered.length > pageSize"
      v-model:page="page"
      :items-per-page="pageSize"
      :total="filtered.length"
      class="self-center"
    />
    <div class="flex flex-wrap justify-end gap-2">
      <UButton
        :label="t('imports.backToSettings')"
        color="neutral"
        variant="outline"
        @click="emit('back')"
      />
      <OfflineGuard v-slot="{ offline }">
        <UButton
          :disabled="offline"
          :label="t('imports.validate')"
          color="primary"
          variant="solid"
          :loading="busy"
          data-testid="import-validate"
          @click="emit('validate', decisions)"
        />
      </OfflineGuard>
    </div>
  </div>
</template>
