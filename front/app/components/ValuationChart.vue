<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import { chartInitOptions } from '~/charts/locale'
import { LineChart } from 'echarts/charts'
import {
  AriaComponent,
  GridComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import type { Valuation } from '@mint/shared/types/valuations'
import { valuationChartOption } from '~/charts/valuations'
import type { ValuationChartProps } from '~~/types/valuations'

use([SVGRenderer, LineChart, GridComponent, TooltipComponent, AriaComponent])

const props = defineProps<ValuationChartProps>()

const { t, locale } = useI18n()
const { formatDate } = useFormatters()
const { theme, animate } = useChartTheme()
const chartHeight = useChartHeight(chartHeights.valuation)
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
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))

const option = computed(() =>
  valuationChartOption({
    valuations: props.valuations,
    theme: theme.value,
    label: t('valuations.value'),
    animate: animate.value,
    formatters: { money: roundedMoney, axisDate, longDate: formatDate },
  }),
)

const columns = computed<TableColumn<Valuation>[]>(() => [
  { accessorKey: 'date', header: t('valuations.date') },
  { accessorKey: 'valueCents', header: t('valuations.value') },
])

const initOptions = computed(() => chartInitOptions(locale.value))
</script>

<template>
  <div class="flex flex-col gap-3">
    <VChart
      :option="option"
      :init-options="initOptions"
      autoresize
      :style="{ height: chartHeight }"
      class="w-full"
      data-testid="valuation-chart"
    />
    <div class="flex justify-end">
      <UButton
        :icon="icons.showData"
        :label="showData ? t('forecast.hideData') : t('forecast.showData')"
        color="neutral"
        variant="ghost"
        :aria-expanded="showData"
        data-testid="valuation-show-data"
        @click="showData = !showData"
      />
    </div>
    <UTable
      v-if="showData"
      :data="valuations"
      :columns="columns"
      data-testid="valuation-table"
    >
      <template #date-cell="{ row }">
        <span class="tabular-nums">{{ formatDate(row.original.date) }}</span>
      </template>
      <template #valueCents-cell="{ row }">
        <MoneyAmount :cents="row.original.valueCents" />
      </template>
    </UTable>
  </div>
</template>
