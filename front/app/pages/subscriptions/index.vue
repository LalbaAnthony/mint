<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { TableColumn } from '@nuxt/ui'
import { subscriptionListResponseSchema } from '@mint/shared/schemas/schedules'
import type {
  Schedule,
  SubscriptionListResponse,
} from '@mint/shared/types/schedules'

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate, formatMoney } = useFormatters()
const referentials = useReferentialsStore()
const labels = usePlanningLabels()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const result = ref<SubscriptionListResponse | null>(null)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const loadState = useLoadState({ onError: notifyFailure })

async function fetchSubscriptions(): Promise<void> {
  const [subscriptions] = await Promise.all([
    apiGet('/subscriptions', subscriptionListResponseSchema),
    referentials.load(),
  ])
  result.value = subscriptions
}

function load(): Promise<void> {
  return loadState.run(fetchSubscriptions, 'background')
}

onMounted(() => loadState.run(fetchSubscriptions))

const selectedId = ref<string | null>(null)
const selected = computed(
  () =>
    result.value?.subscriptions.find(
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

const formOpen = ref(false)
const editedSchedule = ref<Schedule | null>(null)

function edit(schedule: Schedule): void {
  selectedId.value = null
  editedSchedule.value = schedule
  formOpen.value = true
}

async function saved(schedule: Schedule): Promise<void> {
  toast.add({
    title: t('schedules.saved', { label: schedule.label }),
    icon: icons.success,
    color: 'success',
  })
  await load()
}

const subscriptions = computed(() => result.value?.subscriptions ?? [])

const columns = computed<TableColumn<Schedule>[]>(() => [
  { accessorKey: 'label', header: t('schedules.fields.label') },
  { accessorKey: 'amountCents', header: t('schedules.fields.amount') },
  { accessorKey: 'frequency', header: t('subscriptions.periodicity') },
  {
    accessorKey: 'monthlyEquivalentCents',
    header: t('schedules.fields.monthlyEquivalent'),
  },
  { id: 'next', header: t('schedules.fields.nextOccurrence') },
  { id: 'source', header: t('operations.fields.source') },
  { accessorKey: 'triggerMode', header: t('schedules.fields.triggerMode') },
])

const skeletonTableColumns = computed(() =>
  skeletonColumns(columns.value, {
    label: 'text-detail',
    amountCents: 'amount',
    monthlyEquivalentCents: 'amount',
    next: 'date',
  }),
)

const totalLabels = computed(() => [
  t('subscriptions.monthlyTotal'),
  t('subscriptions.annualTotal'),
])

const skeletonRows = useRememberedCount(
  'subscriptions',
  loadState,
  () => subscriptions.value.length,
)
</script>

<template>
  <ViewPanel :title="t('navigation.subscriptions')">
    <LoadZone :state="loadState" class="flex flex-col gap-4">
      <template #skeleton>
        <StatGrid :columns="2">
          <StatTile v-for="label in totalLabels" :key="label" :label="label">
            <template #default="{ valueClass }">
              <SkeletonAmount concealable :class="valueClass" />
            </template>
          </StatTile>
        </StatGrid>
        <UCard data-testid="subscriptions-list-skeleton">
          <SkeletonTable
            v-if="isDesktop"
            :columns="skeletonTableColumns"
            :count="skeletonRows"
          />
          <SkeletonList
            :count="skeletonRows"
            v-else
            :row="{ gap: 3 }"
            class="flex flex-col divide-y divide-default"
          >
            <template #default="{ index }">
              <div class="min-w-0 flex-1">
                <SkeletonText
                  :width="skeletonRowWidth(index)"
                  class="text-sm"
                />
                <SkeletonText width="md" class="text-xs" />
              </div>
              <div class="flex flex-col items-end">
                <SkeletonAmount class="text-sm" />
                <SkeletonText width="sm" class="text-xs" />
              </div>
            </template>
          </SkeletonList>
        </UCard>
      </template>
      <template #error="{ retry }">
        <UCard>
          <LoadError @retry="retry" />
        </UCard>
      </template>
      <div v-if="result !== null" class="flex flex-col gap-4">
        <StatGrid :columns="2" data-testid="subscription-totals">
          <StatTile :label="t('subscriptions.monthlyTotal')">
            <template #default="{ valueClass }">
              <MoneyAmount
                :cents="result.totals.monthlyCents"
                :class="valueClass"
                concealable
                data-testid="subscriptions-monthly"
              />
            </template>
          </StatTile>
          <StatTile :label="t('subscriptions.annualTotal')">
            <template #default="{ valueClass }">
              <MoneyAmount
                :cents="result.totals.annualCents"
                :class="valueClass"
                concealable
                data-testid="subscriptions-annual"
              />
            </template>
          </StatTile>
        </StatGrid>

        <UCard data-testid="subscriptions-list">
          <EmptyState
            v-if="subscriptions.length === 0"
            :icon="icons.subscriptions"
            :title="t('subscriptions.emptyTitle')"
            :description="t('subscriptions.emptyText')"
          >
            <UButton
              :label="t('subscriptions.goToSchedules')"
              :icon="icons.schedules"
              to="/schedules"
              color="primary"
              variant="soft"
            />
          </EmptyState>
          <UTable
            v-else-if="isDesktop"
            :data="subscriptions"
            :columns="columns"
            class="cursor-pointer"
            data-testid="subscriptions-table"
            @select="(_event, row) => (selectedId = row.original.id)"
          >
            <template #label-cell="{ row }">
              <span class="text-default">{{ row.original.label }}</span>
              <p class="text-xs text-muted">
                {{ referentials.categoryName(row.original.categoryId) }}
              </p>
            </template>
            <template #amountCents-cell="{ row }">
              <MoneyAmount :cents="-row.original.amountCents" variant="flow" />
            </template>
            <template #frequency-cell="{ row }">
              {{ labels.recurrenceLabel(row.original) }}
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
            <template #source-cell="{ row }">
              {{ labels.scheduleSourceLabel(row.original) }}
            </template>
            <template #triggerMode-cell="{ row }">
              <span class="flex items-center gap-2">
                <PlanningMarker
                  v-if="row.original.triggerMode === 'manual'"
                  kind="manual"
                />
                {{ t(`schedules.triggerModes.${row.original.triggerMode}`) }}
              </span>
            </template>
          </UTable>
          <ul v-else class="flex flex-col divide-y divide-default">
            <li v-for="schedule in subscriptions" :key="schedule.id">
              <ListRow
                as="button"
                :gap="3"
                :data-testid="`subscription-${schedule.id}`"
                @click="selectedId = schedule.id"
              >
                <div class="min-w-0 flex-1">
                  <p
                    class="flex items-center gap-2 truncate text-sm text-default"
                  >
                    <span class="truncate">{{ schedule.label }}</span>
                    <PlanningMarker
                      v-if="schedule.triggerMode === 'manual'"
                      kind="manual"
                    />
                  </p>
                  <p class="truncate text-xs text-muted">
                    {{ labels.recurrenceLabel(schedule) }}
                    <template v-if="schedule.nextOccurrence !== null">
                      · {{ formatDate(schedule.nextOccurrence.effectiveDate) }}
                    </template>
                  </p>
                </div>
                <div class="flex flex-col items-end">
                  <MoneyAmount
                    :cents="-schedule.amountCents"
                    variant="flow"
                    class="text-sm"
                  />
                  <span
                    v-if="schedule.monthlyEquivalentCents !== null"
                    class="text-xs text-muted tabular-nums"
                  >
                    {{
                      t('subscriptions.perMonth', {
                        amount: formatMoney(schedule.monthlyEquivalentCents),
                      })
                    }}
                  </span>
                </div>
              </ListRow>
            </li>
          </ul>
        </UCard>
      </div>
    </LoadZone>

    <ScheduleFormModal
      v-model:open="formOpen"
      :schedule="editedSchedule"
      @saved="saved"
    />
    <ScheduleDetailModal
      v-model:open="detailOpen"
      :schedule="selected"
      @edit="edit"
      @changed="load"
    />
  </ViewPanel>
</template>
