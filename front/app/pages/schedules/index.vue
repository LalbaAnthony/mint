<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { TableColumn } from '@nuxt/ui'
import { scheduleListResponseSchema } from '@mint/shared/schemas/schedules'
import type {
  Schedule,
  ScheduleListResponse,
} from '@mint/shared/types/schedules'
import type { SelectItem } from '~~/types/forms'
import type { ScheduleKindFilter } from '~~/types/planning'

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()
const labels = usePlanningLabels()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const result = ref<ScheduleListResponse | null>(null)
const kindFilter = ref<ScheduleKindFilter>('all')
const foldedOpen = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const selectedId = ref<string | null>(null)
const selected = computed(
  () =>
    result.value?.schedules.find(
      (schedule) => schedule.id === selectedId.value,
    ) ?? null,
)
const detailOpen = computed({
  get: () => selected.value !== null,
  set: (open) => {
    if (!open) {
      selectedId.value = null
    }
  },
})

async function load(): Promise<void> {
  try {
    const [schedules] = await Promise.all([
      apiGet('/schedules', scheduleListResponseSchema),
      referentials.load(),
    ])
    result.value = schedules
  } catch (error) {
    notifyFailure(error)
  }
}

onMounted(load)

const kindItems = computed<SelectItem<ScheduleKindFilter>[]>(() => [
  { label: t('schedules.filters.all'), value: 'all' },
  { label: t('schedules.filters.expense'), value: 'expense' },
  { label: t('schedules.filters.income'), value: 'income' },
  { label: t('schedules.filters.transfer'), value: 'transfer' },
])

function matchesKind(schedule: Schedule): boolean {
  return kindFilter.value === 'all' || schedule.kind === kindFilter.value
}

const visible = computed(() =>
  (result.value?.schedules ?? []).filter(
    (schedule) => !isFolded(schedule) && matchesKind(schedule),
  ),
)

const folded = computed(() =>
  (result.value?.schedules ?? []).filter(
    (schedule) => isFolded(schedule) && matchesKind(schedule),
  ),
)

function signed(schedule: Schedule): number {
  return schedule.kind === 'expense'
    ? -schedule.amountCents
    : schedule.amountCents
}

function categoryLabel(schedule: Schedule): string {
  return schedule.categoryId === null
    ? ''
    : referentials.categoryName(schedule.categoryId)
}

const columns = computed<TableColumn<Schedule>[]>(() => [
  { accessorKey: 'label', header: t('schedules.fields.label') },
  { accessorKey: 'kind', header: t('schedules.fields.kind') },
  { id: 'source', header: t('operations.fields.source') },
  { accessorKey: 'frequency', header: t('schedules.fields.recurrence') },
  { accessorKey: 'amountCents', header: t('schedules.fields.amount') },
  {
    accessorKey: 'monthlyEquivalentCents',
    header: t('schedules.fields.monthlyEquivalent'),
  },
  { id: 'next', header: t('schedules.fields.nextOccurrence') },
])

const formOpen = ref(false)
const editedSchedule = ref<Schedule | null>(null)

function openForm(schedule: Schedule | null): void {
  editedSchedule.value = schedule
  formOpen.value = true
}

function editFromDetail(schedule: Schedule): void {
  selectedId.value = null
  openForm(schedule)
}

async function saved(
  schedule: Schedule,
  removedExceptions: number,
): Promise<void> {
  toast.add({
    title: t('schedules.saved', { label: schedule.label }),
    description:
      removedExceptions > 0
        ? t(
            'schedules.removedExceptions',
            { n: removedExceptions },
            removedExceptions,
          )
        : undefined,
    icon: removedExceptions > 0 ? icons.belowThreshold : icons.success,
    color: removedExceptions > 0 ? 'warning' : 'success',
  })
  await load()
}
</script>

<template>
  <ViewPanel :title="t('navigation.schedules')">
    <template #actions>
      <UButton
        :icon="icons.add"
        :aria-label="t('schedules.add')"
        color="primary"
        variant="soft"
        data-testid="schedules-add"
        @click="openForm(null)"
      >
        <span class="max-sm:sr-only">{{ t('schedules.add') }}</span>
      </UButton>
    </template>

    <div v-if="result !== null" class="flex flex-col gap-4">
      <div
        class="grid grid-cols-1 gap-4 md:grid-cols-3"
        data-testid="schedule-totals"
      >
        <UCard>
          <p class="text-sm font-medium text-muted">
            {{ t('schedules.totals.expenses') }}
          </p>
          <MoneyAmount
            :cents="result.totals.expensesCents"
            class="text-xl font-semibold"
            data-testid="total-expenses"
          />
        </UCard>
        <UCard>
          <p class="text-sm font-medium text-muted">
            {{ t('schedules.totals.incomes') }}
          </p>
          <MoneyAmount
            :cents="result.totals.incomesCents"
            class="text-xl font-semibold"
            data-testid="total-incomes"
          />
        </UCard>
        <UCard>
          <p class="text-sm font-medium text-muted">
            {{ t('schedules.totals.savingsTransfers') }}
          </p>
          <MoneyAmount
            :cents="result.totals.savingsTransfersCents"
            class="text-xl font-semibold"
            data-testid="total-savings"
          />
        </UCard>
      </div>

      <URadioGroup
        v-model="kindFilter"
        :items="kindItems"
        orientation="horizontal"
        variant="table"
        :legend="t('schedules.filters.legend')"
        data-testid="schedule-kind-filter"
      />

      <UCard data-testid="schedules-list">
        <EmptyState
          v-if="visible.length === 0"
          :icon="icons.schedules"
          :title="t('schedules.emptyTitle')"
          :description="t('schedules.emptyText')"
        >
          <UButton
            :label="t('schedules.add')"
            :icon="icons.add"
            color="primary"
            variant="soft"
            @click="openForm(null)"
          />
        </EmptyState>
        <UTable
          v-else-if="isDesktop"
          :data="visible"
          :columns="columns"
          class="cursor-pointer"
          data-testid="schedules-table"
          @select="(_event, row) => (selectedId = row.original.id)"
        >
          <template #label-cell="{ row }">
            <div class="flex items-center gap-2">
              <span class="text-default">{{ row.original.label }}</span>
              <PlanningMarker
                v-if="row.original.triggerMode === 'manual'"
                kind="manual"
              />
              <PlanningMarker
                v-if="row.original.isSubscription"
                kind="subscription"
              />
              <CapExcessBadge
                v-if="row.original.capExcess !== null"
                :excess-cents="row.original.capExcess.excessCents"
              />
            </div>
            <p class="text-xs text-muted">{{ categoryLabel(row.original) }}</p>
          </template>
          <template #kind-cell="{ row }">
            <span class="flex items-center gap-1">
              <UIcon
                :name="icons[row.original.kind]"
                class="size-4 text-muted"
              />
              {{ labels.kindLabel(row.original.kind) }}
            </span>
          </template>
          <template #source-cell="{ row }">
            {{ labels.scheduleSourceLabel(row.original) }}
          </template>
          <template #frequency-cell="{ row }">
            {{ labels.recurrenceLabel(row.original) }}
          </template>
          <template #amountCents-cell="{ row }">
            <MoneyAmount :cents="signed(row.original)" variant="flow" />
          </template>
          <template #monthlyEquivalentCents-cell="{ row }">
            <MoneyAmount
              v-if="row.original.monthlyEquivalentCents !== null"
              :cents="row.original.monthlyEquivalentCents"
            />
            <span v-else class="text-muted">{{
              t('schedules.notCounted')
            }}</span>
          </template>
          <template #next-cell="{ row }">
            <span class="tabular-nums">
              {{
                row.original.nextOccurrence === null
                  ? ''
                  : formatDate(row.original.nextOccurrence.effectiveDate)
              }}
            </span>
          </template>
        </UTable>
        <ul v-else class="flex flex-col divide-y divide-default">
          <li v-for="schedule in visible" :key="schedule.id">
            <button
              type="button"
              class="flex w-full items-center gap-3 py-2 text-left"
              :data-testid="`schedule-${schedule.id}`"
              @click="selectedId = schedule.id"
            >
              <UIcon
                :name="icons[schedule.kind]"
                class="size-4 shrink-0 text-muted"
              />
              <div class="min-w-0 flex-1">
                <p
                  class="flex items-center gap-2 truncate text-sm text-default"
                >
                  <span class="truncate">{{ schedule.label }}</span>
                  <PlanningMarker
                    v-if="schedule.triggerMode === 'manual'"
                    kind="manual"
                  />
                  <PlanningMarker
                    v-if="schedule.isSubscription"
                    kind="subscription"
                  />
                  <CapExcessBadge
                    v-if="schedule.capExcess !== null"
                    :excess-cents="schedule.capExcess.excessCents"
                  />
                </p>
                <p class="truncate text-xs text-muted">
                  {{ labels.recurrenceLabel(schedule) }}
                  <template v-if="schedule.nextOccurrence !== null">
                    · {{ formatDate(schedule.nextOccurrence.effectiveDate) }}
                  </template>
                </p>
              </div>
              <MoneyAmount
                :cents="signed(schedule)"
                variant="flow"
                class="text-sm"
              />
            </button>
          </li>
        </ul>
      </UCard>

      <UCard v-if="folded.length > 0">
        <UCollapsible v-model:open="foldedOpen">
          <UButton
            :label="t('schedules.foldedSection', { n: folded.length })"
            :icon="foldedOpen ? icons.collapse : icons.expand"
            color="neutral"
            variant="ghost"
            block
            class="justify-start"
            data-testid="schedules-folded-toggle"
          />
          <template #content>
            <ul class="flex flex-col divide-y divide-default pt-2">
              <li v-for="schedule in folded" :key="schedule.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 py-2 text-left"
                  @click="selectedId = schedule.id"
                >
                  <p class="min-w-0 flex-1 truncate text-sm text-muted">
                    {{ schedule.label }}
                  </p>
                  <UBadge
                    :label="
                      schedule.active
                        ? t('schedules.ended')
                        : t('schedules.inactive')
                    "
                    color="neutral"
                    variant="soft"
                  />
                </button>
              </li>
            </ul>
          </template>
        </UCollapsible>
      </UCard>
    </div>

    <ScheduleFormModal
      v-model:open="formOpen"
      :schedule="editedSchedule"
      @saved="saved"
    />

    <ScheduleDetailModal
      v-model:open="detailOpen"
      :schedule="selected"
      @edit="editFromDetail"
      @changed="load"
    />
  </ViewPanel>
</template>
