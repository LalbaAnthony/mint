<script setup lang="ts">
import {
  addMonthsToMonth,
  monthEnd,
  monthStart,
} from '@mint/shared/engines/dates'
import {
  breakdownResponseSchema,
  dashboardSummarySchema,
  monthlyReportResponseSchema,
} from '@mint/shared/schemas/dashboard'
import { balanceCurveResponseSchema } from '@mint/shared/schemas/forecast'
import type {
  BreakdownResponse,
  DashboardSummary,
  MonthlyReportResponse,
} from '@mint/shared/types/dashboard'
import type { BalanceCurveResponse } from '@mint/shared/types/forecast'
import type { BreakdownPeriodMode } from '~~/types/dashboard'

const { t, locale } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()
const view = useForecastViewStore()
const editor = useOperationEditorStore()

const curve = ref<BalanceCurveResponse | null>(null)
const ready = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function loadCurve(): Promise<void> {
  if (referentials.activeAccounts.length === 0) {
    curve.value = null
    return
  }
  try {
    curve.value = await apiGet(
      `/forecast/curve?${view.scopeQuery(view.dashboardAccountId)}`,
      balanceCurveResponseSchema,
    )
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 409) &&
      view.dashboardAccountId !== null
    ) {
      view.dashboardAccountId = null
      return
    }
    notifyFailure(error)
  }
}

const summary = ref<DashboardSummary | null>(null)
const breakdown = ref<BreakdownResponse | null>(null)
const monthly = ref<MonthlyReportResponse | null>(null)
const periodMode = ref<BreakdownPeriodMode>('month')
const breakdownMonth = ref(monthStart(parisDate(new Date())))
const customFrom = ref(breakdownMonth.value)
const customTo = ref(monthEnd(breakdownMonth.value))

const periodQuery = computed(() =>
  periodMode.value === 'month'
    ? `from=${breakdownMonth.value}&to=${monthEnd(breakdownMonth.value)}`
    : `from=${customFrom.value}&to=${customTo.value}`,
)

async function loadBreakdown(): Promise<void> {
  if (periodMode.value === 'custom' && customFrom.value > customTo.value) {
    return
  }
  try {
    breakdown.value = await apiGet(
      `/dashboard/breakdown?${periodQuery.value}`,
      breakdownResponseSchema,
    )
  } catch (error) {
    notifyFailure(error)
  }
}

async function loadMonthly(): Promise<void> {
  try {
    monthly.value = await apiGet(
      `/dashboard/monthly?horizonMonths=${view.horizonMonths}`,
      monthlyReportResponseSchema,
    )
  } catch (error) {
    notifyFailure(error)
  }
}

async function loadSummary(): Promise<void> {
  try {
    summary.value = await apiGet('/dashboard/summary', dashboardSummarySchema)
  } catch (error) {
    notifyFailure(error)
  }
}

async function load(): Promise<void> {
  try {
    await referentials.load()
  } catch (error) {
    notifyFailure(error)
  }
  await Promise.all([
    loadCurve(),
    loadSummary(),
    loadBreakdown(),
    loadMonthly(),
  ])
  ready.value = true
}

onMounted(load)
watch(() => editor.savedVersion, load)
watch(() => [view.dashboardAccountId, view.horizonMonths], loadCurve)
watch(() => view.horizonMonths, loadMonthly)
watch(periodQuery, loadBreakdown)

const monthTitle = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${breakdownMonth.value}T00:00:00Z`)),
)

const periodItems = computed(() => [
  { label: t('dashboard.periodMonth'), value: 'month' },
  { label: t('dashboard.periodCustom'), value: 'custom' },
])

function shiftMonth(offset: number): void {
  breakdownMonth.value = addMonthsToMonth(breakdownMonth.value, offset)
}

const indicators = computed(() => curve.value?.indicators ?? null)
</script>

<template>
  <ViewPanel :title="t('navigation.home')">
    <div v-if="ready" class="flex flex-col gap-4">
      <DashboardBanner v-if="summary !== null" :summary="summary" />
      <UCard data-testid="dashboard-balance">
        <template #header>
          <div class="flex flex-col gap-3">
            <h2 class="text-base font-semibold text-highlighted">
              {{ t('forecast.curveTitle') }}
            </h2>
            <ForecastScopeControls
              v-if="referentials.activeAccounts.length > 0"
              v-model:account-id="view.dashboardAccountId"
            />
          </div>
        </template>
        <EmptyState
          v-if="referentials.activeAccounts.length === 0"
          :icon="icons.accounts"
          :title="t('forecast.noAccountTitle')"
          :description="t('forecast.noAccountText')"
        >
          <UButton
            :label="t('forecast.goToAccounts')"
            :icon="icons.accounts"
            to="/accounts"
            color="primary"
            variant="soft"
          />
        </EmptyState>
        <div v-else-if="curve !== null" class="flex flex-col gap-3">
          <ul
            v-if="indicators !== null"
            class="flex flex-col gap-1 text-sm text-muted"
            data-testid="dashboard-indicators"
          >
            <li
              class="flex flex-wrap items-center gap-1"
              data-testid="dashboard-minimum"
            >
              {{
                t('forecast.minimumOn', {
                  date: formatDate(indicators.minBalanceDate),
                })
              }}
              <MoneyAmount
                :cents="indicators.minBalanceCents"
                :threshold="curve.thresholdCents"
              />
            </li>
            <li
              v-if="indicators.firstBelowThresholdDate !== null"
              class="flex items-center gap-1 text-warning"
              data-testid="dashboard-below-threshold"
            >
              <UIcon :name="icons.belowThreshold" class="size-4 shrink-0" />
              {{
                t('forecast.belowThresholdFrom', {
                  date: formatDate(indicators.firstBelowThresholdDate),
                })
              }}
            </li>
            <li
              v-if="indicators.firstNegativeDate !== null"
              class="flex items-center gap-1 text-error"
              data-testid="dashboard-negative"
            >
              <UIcon :name="icons.negative" class="size-4 shrink-0" />
              {{
                t('forecast.negativeFrom', {
                  date: formatDate(indicators.firstNegativeDate),
                })
              }}
            </li>
          </ul>
          <LazyBalanceCurveChart :curve="curve" />
        </div>
      </UCard>
      <UCard v-if="breakdown !== null" data-testid="dashboard-breakdown">
        <template #header>
          <div class="flex flex-wrap items-end justify-between gap-3">
            <h2 class="text-base font-semibold text-highlighted">
              {{ t('dashboard.breakdownTitle') }}
            </h2>
            <div class="flex flex-wrap items-end gap-2">
              <USelect
                v-model="periodMode"
                :items="periodItems"
                :aria-label="t('dashboard.period')"
                class="w-48"
                data-testid="breakdown-period"
              />
              <template v-if="periodMode === 'month'">
                <UButton
                  :icon="icons.previous"
                  :aria-label="t('calendar.previousMonth')"
                  color="neutral"
                  variant="ghost"
                  @click="shiftMonth(-1)"
                />
                <span class="text-sm font-medium first-letter:uppercase">
                  {{ monthTitle }}
                </span>
                <UButton
                  :icon="icons.next"
                  :aria-label="t('calendar.nextMonth')"
                  color="neutral"
                  variant="ghost"
                  @click="shiftMonth(1)"
                />
              </template>
              <template v-else>
                <UInput
                  v-model="customFrom"
                  type="date"
                  :aria-label="t('operations.filters.from')"
                />
                <UInput
                  v-model="customTo"
                  type="date"
                  :aria-label="t('operations.filters.to')"
                />
              </template>
            </div>
          </div>
        </template>
        <LazyBreakdownChart :breakdown="breakdown" />
      </UCard>
      <UCard v-if="monthly !== null" data-testid="dashboard-monthly">
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t('dashboard.monthlyTitle') }}
          </h2>
        </template>
        <LazyMonthlyChart :report="monthly" />
      </UCard>
    </div>
  </ViewPanel>
</template>
