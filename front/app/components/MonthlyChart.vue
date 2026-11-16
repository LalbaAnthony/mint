<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { chartInitOptions } from '~/charts/locale'
import { BarChart, LineChart } from 'echarts/charts'
import {
  AriaComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { monthlyOption } from '~/charts/monthly'
import type { MonthlyChartProps } from '~~/types/dashboard'

use([
  SVGRenderer,
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  MarkLineComponent,
  AriaComponent,
])

const props = defineProps<MonthlyChartProps>()

const { t, locale } = useI18n()
const { theme, animate } = useChartTheme()
const isDesktop = useMediaQuery('(min-width: 1024px)')
const showData = ref(false)

const roundedMoney = (cents: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat(locale.value, {
    month: 'short',
    year: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${month}T00:00:00Z`))
}

const option = computed(() =>
  monthlyOption({
    report: props.report,
    theme: theme.value,
    labels: {
      realIncome: t('dashboard.realIncome'),
      plannedIncome: t('dashboard.plannedIncome'),
      realExpense: t('dashboard.realExpense'),
      plannedExpense: t('dashboard.plannedExpense'),
      net: t('dashboard.net'),
      today: t('forecast.today'),
    },
    money: roundedMoney,
    monthLabel,
    animate: animate.value,
  }),
)

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
      data-testid="monthly-chart"
    />
    <div class="flex justify-end">
      <UButton
        :icon="icons.showData"
        :label="showData ? t('forecast.hideData') : t('forecast.showData')"
        color="neutral"
        variant="ghost"
        :aria-expanded="showData"
        data-testid="monthly-show-data"
        @click="showData = !showData"
      />
    </div>
    <div v-if="showData" class="overflow-x-auto" data-testid="monthly-table">
      <table class="w-full text-sm">
        <thead>
          <tr class="text-left text-xs font-medium text-muted">
            <th class="py-1">{{ t('dashboard.month') }}</th>
            <th class="py-1 text-right">{{ t('dashboard.realIncome') }}</th>
            <th class="py-1 text-right">{{ t('dashboard.plannedIncome') }}</th>
            <th class="py-1 text-right">{{ t('dashboard.realExpense') }}</th>
            <th class="py-1 text-right">
              {{ t('dashboard.plannedExpense') }}
            </th>
            <th class="py-1 text-right">{{ t('dashboard.net') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="month in report.months"
            :key="month.month"
            class="border-t border-default"
          >
            <td class="py-1 first-letter:uppercase">
              {{ monthLabel(month.month) }}
            </td>
            <td class="py-1 text-right">
              <MoneyAmount :cents="month.real.incomeCents" />
            </td>
            <td class="py-1 text-right">
              <MoneyAmount :cents="month.planned.incomeCents" />
            </td>
            <td class="py-1 text-right">
              <MoneyAmount :cents="month.real.expenseCents" />
            </td>
            <td class="py-1 text-right">
              <MoneyAmount :cents="month.planned.expenseCents" />
            </td>
            <td class="py-1 text-right">
              <MoneyAmount :cents="month.balanceCents" />
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
