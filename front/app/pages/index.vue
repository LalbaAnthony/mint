<script setup lang="ts">
import { balanceCurveResponseSchema } from '@mint/shared/schemas/forecast'
import type { BalanceCurveResponse } from '@mint/shared/types/forecast'

const { t } = useI18n()
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

async function load(): Promise<void> {
  try {
    await referentials.load()
  } catch (error) {
    notifyFailure(error)
  }
  await loadCurve()
  ready.value = true
}

onMounted(load)
watch(() => editor.savedVersion, load)
watch(() => [view.dashboardAccountId, view.horizonMonths], loadCurve)

const indicators = computed(() => curve.value?.indicators ?? null)
</script>

<template>
  <ViewPanel :title="t('navigation.home')">
    <UCard v-if="ready" data-testid="dashboard-balance">
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
  </ViewPanel>
</template>
