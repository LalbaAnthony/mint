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
import { balanceCurveChart, breakdownChart, monthlyChart } from '~/charts/lazy'
import type { BreakdownPeriodMode } from '~~/types/dashboard'
import type { LoadMode } from '~~/types/skeleton'

const CurveChart = balanceCurveChart.component
const GroupBreakdownChart = breakdownChart.component
const MonthlyReportChart = monthlyChart.component

const { t, locale } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()
const view = useForecastViewStore()
const editor = useOperationEditorStore()

const curve = ref<BalanceCurveResponse | null>(null)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const summaryState = useLoadState({ onError: notifyFailure })
const curveState = useLoadState({ onError: notifyFailure })
const breakdownState = useLoadState({ onError: notifyFailure })
const monthlyState = useLoadState({ onError: notifyFailure })

async function loadCurve(): Promise<void> {
  if (referentials.activeAccounts.length === 0) {
    curve.value = null
    return
  }
  try {
    const [response] = await Promise.all([
      apiGet(
        `/forecast/curve?${view.scopeQuery(view.dashboardAccountId)}`,
        balanceCurveResponseSchema,
      ),
      balanceCurveChart.load(),
    ])
    curve.value = response
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 404 || error.status === 409) &&
      view.dashboardAccountId !== null
    ) {
      view.dashboardAccountId = null
      return
    }
    throw error
  }
}

async function loadCurveSection(): Promise<void> {
  await referentials.load()
  await loadCurve()
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
  const [response] = await Promise.all([
    apiGet(
      `/dashboard/breakdown?${periodQuery.value}`,
      breakdownResponseSchema,
    ),
    breakdownChart.load(),
  ])
  breakdown.value = response
}

async function loadMonthly(): Promise<void> {
  const [response] = await Promise.all([
    apiGet(
      `/dashboard/monthly?horizonMonths=${view.horizonMonths}`,
      monthlyReportResponseSchema,
    ),
    monthlyChart.load(),
  ])
  monthly.value = response
}

async function loadSummary(): Promise<void> {
  summary.value = await apiGet('/dashboard/summary', dashboardSummarySchema)
}

function loadSections(mode: LoadMode): void {
  void summaryState.run(loadSummary, mode)
  void curveState.run(loadCurveSection, mode)
  void breakdownState.run(loadBreakdown, mode)
  void monthlyState.run(loadMonthly, mode)
}

onMounted(() => loadSections('context'))
watch(
  () => editor.savedVersion,
  () => loadSections('background'),
)
watch(
  () => [view.dashboardAccountId, view.horizonMonths],
  () => curveState.run(loadCurve),
)
watch(
  () => view.horizonMonths,
  () => monthlyState.run(loadMonthly),
)
watch(periodQuery, () => breakdownState.run(loadBreakdown))

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
    <div class="flex flex-col gap-4">
      <LoadZone :state="summaryState">
        <template #skeleton>
          <DashboardBannerSkeleton />
        </template>
        <template #error="{ retry }">
          <UCard data-testid="dashboard-banner-error">
            <LoadError @retry="retry" />
          </UCard>
        </template>
        <DashboardBanner v-if="summary !== null" :summary="summary" />
      </LoadZone>
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
            <ForecastScopeControlsSkeleton
              v-else-if="!curveState.settled"
              :class="curveState.phase === 'pending' ? 'invisible' : ''"
            />
          </div>
        </template>
        <LoadZone :state="curveState">
          <template #skeleton>
            <div class="flex flex-col gap-3">
              <SkeletonText width="xl" class="text-sm" />
              <BalanceCurveChartSkeleton />
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
                  concealable
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
            <CurveChart :curve="curve" />
          </div>
        </LoadZone>
      </UCard>
      <UCard data-testid="dashboard-breakdown">
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
        <LoadZone :state="breakdownState">
          <template #skeleton>
            <BreakdownChartSkeleton />
          </template>
          <GroupBreakdownChart
            v-if="breakdown !== null"
            :breakdown="breakdown"
          />
        </LoadZone>
      </UCard>
      <UCard data-testid="dashboard-monthly">
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t('dashboard.monthlyTitle') }}
          </h2>
        </template>
        <LoadZone :state="monthlyState">
          <template #skeleton>
            <MonthlyChartSkeleton />
          </template>
          <MonthlyReportChart v-if="monthly !== null" :report="monthly" />
        </LoadZone>
      </UCard>
    </div>
  </ViewPanel>
</template>
