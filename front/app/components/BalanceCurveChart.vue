<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { chartInitOptions } from '~/charts/locale'
import type { TableColumn } from '@nuxt/ui'
import { LineChart } from 'echarts/charts'
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  TooltipComponent,
  VisualMapPiecewiseComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { balanceCurveOption } from '~/charts/balance-curve'
import type { BalanceCurvePoint } from '@mint/shared/types/forecast'
import type { BalanceCurveChartProps } from '~~/types/forecast'

use([
  SVGRenderer,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  MarkPointComponent,
  VisualMapPiecewiseComponent,
  AriaComponent,
])

const props = defineProps<BalanceCurveChartProps>()

const { t, locale } = useI18n()
const { formatDate } = useFormatters()
const { theme, animate } = useChartTheme()
const { chartMoney, chartDescription } = useAmountMask()
const isDesktop = useMediaQuery('(min-width: 1024px)')
const showData = ref(false)

const roundedMoney = (cents: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)

const axisDate = (date: string) =>
  new Intl.DateTimeFormat(locale.value, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))

const option = computed(() =>
  balanceCurveOption({
    curve: props.curve,
    theme: theme.value,
    animate: animate.value,
    labels: {
      real: t('forecast.real'),
      forecast: t('forecast.planned'),
      today: t('forecast.today'),
      threshold: t('forecast.threshold'),
      minimum: t('forecast.minimum'),
    },
    formatters: {
      money: chartMoney(roundedMoney),
      axisDate,
      longDate: formatDate,
    },
    ariaDescription: chartDescription.value,
  }),
)

const rows = computed(() =>
  props.curve.points.filter((point) => point.balanceCents !== null),
)

const columns = computed<TableColumn<BalanceCurvePoint>[]>(() => [
  { accessorKey: 'date', header: t('forecast.date') },
  { accessorKey: 'balanceCents', header: t('forecast.balance') },
  { accessorKey: 'forecast', header: t('forecast.nature') },
])

const initOptions = computed(() => chartInitOptions(locale.value))
</script>

<template>
  <div class="flex flex-col gap-3">
    <VChart
      :option="option"
      :init-options="initOptions"
      autoresize
      :style="{ height: isDesktop ? '320px' : '240px' }"
      class="w-full"
      data-testid="balance-curve-chart"
    />
    <div class="flex justify-end">
      <UButton
        :icon="icons.showData"
        :label="showData ? t('forecast.hideData') : t('forecast.showData')"
        color="neutral"
        variant="ghost"
        :aria-expanded="showData"
        data-testid="balance-curve-show-data"
        @click="showData = !showData"
      />
    </div>
    <div
      v-if="showData"
      class="max-h-96 overflow-y-auto"
      data-testid="balance-curve-table"
    >
      <UTable :data="rows" :columns="columns">
        <template #date-cell="{ row }">
          <span class="tabular-nums">{{ formatDate(row.original.date) }}</span>
        </template>
        <template #balanceCents-cell="{ row }">
          <MoneyAmount
            v-if="row.original.balanceCents !== null"
            :cents="row.original.balanceCents"
            :threshold="curve.thresholdCents"
            concealable
          />
        </template>
        <template #forecast-cell="{ row }">
          {{
            row.original.forecast ? t('forecast.planned') : t('forecast.real')
          }}
        </template>
      </UTable>
    </div>
  </div>
</template>
