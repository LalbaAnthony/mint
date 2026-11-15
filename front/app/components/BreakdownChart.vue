<script setup lang="ts">
import { PieChart } from 'echarts/charts'
import {
  AriaComponent,
  GraphicComponent,
  TooltipComponent,
} from 'echarts/components'
import { use } from 'echarts/core'
import { SVGRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import {
  categorySlices,
  donutOption,
  groupRows,
  groupSlices,
} from '~/charts/breakdown'
import type { BreakdownChartProps, BreakdownGroup } from '~~/types/dashboard'

use([SVGRenderer, PieChart, TooltipComponent, AriaComponent, GraphicComponent])

const props = defineProps<BreakdownChartProps>()

const { t, locale } = useI18n()
const { formatMoney } = useFormatters()
const { theme, animate } = useChartTheme()
const referentials = useReferentialsStore()

const drilled = ref<'needs' | 'wants' | null>(null)
const showData = ref(false)

const groupNames = computed<Record<BreakdownGroup, string>>(() => ({
  needs: t('groups.needs'),
  wants: t('groups.wants'),
  save: t('groups.save'),
}))

const roundedMoney = (cents: number) =>
  new Intl.NumberFormat(locale.value, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(cents / 100)

function categoryOrder(id: string): number {
  return (
    referentials.categories.find((category) => category.id === id)?.sortOrder ??
    0
  )
}

const slices = computed(() =>
  drilled.value === null
    ? groupSlices(props.breakdown, groupNames.value, theme.value)
    : categorySlices(
        props.breakdown,
        drilled.value,
        (id) => referentials.categoryName(id),
        categoryOrder,
        theme.value,
      ),
)

const option = computed(() =>
  donutOption({
    slices: slices.value,
    totalLabel:
      drilled.value === null
        ? t('dashboard.totalSpending')
        : groupNames.value[drilled.value],
    theme: theme.value,
    money: roundedMoney,
    animate: animate.value,
  }),
)

const rows = computed(() => groupRows(props.breakdown, groupNames.value))

function percent(value: number): string {
  return new Intl.NumberFormat(locale.value, {
    maximumFractionDigits: 1,
  }).format(value)
}

function onSliceClick(params: { data?: unknown }): void {
  const data = params.data
  if (drilled.value !== null || typeof data !== 'object' || data === null) {
    return
  }
  const id: unknown = Reflect.get(data, 'id')
  if (id === 'needs' || id === 'wants') {
    drilled.value = id
  }
}
</script>

<template>
  <div class="flex flex-col gap-4 lg:flex-row lg:items-start">
    <div class="flex flex-col gap-2 lg:flex-1">
      <UButton
        v-if="drilled !== null"
        :icon="icons.previous"
        :label="t('dashboard.backToGroups')"
        color="neutral"
        variant="ghost"
        class="self-start"
        data-testid="breakdown-back"
        @click="drilled = null"
      />
      <VChart
        :option="option"
        :init-options="{ renderer: 'svg' }"
        autoresize
        style="height: 280px"
        class="w-full"
        data-testid="breakdown-chart"
        @click="onSliceClick"
      />
      <div class="flex flex-wrap gap-2">
        <UButton
          v-for="group in ['needs', 'wants'] as const"
          :key="group"
          :label="t('dashboard.detailOf', { group: groupNames[group] })"
          color="neutral"
          variant="outline"
          size="sm"
          :data-testid="`breakdown-drill-${group}`"
          @click="drilled = group"
        />
        <UButton
          :icon="icons.showData"
          :label="showData ? t('forecast.hideData') : t('forecast.showData')"
          color="neutral"
          variant="ghost"
          size="sm"
          :aria-expanded="showData"
          @click="showData = !showData"
        />
      </div>
      <ul
        v-if="showData"
        class="flex flex-col divide-y divide-default text-sm"
        data-testid="breakdown-data"
      >
        <li
          v-for="slice in slices"
          :key="slice.id"
          class="flex justify-between gap-2 py-1"
        >
          <span>{{ slice.name }}</span>
          <MoneyAmount :cents="slice.valueCents" />
        </li>
      </ul>
    </div>
    <table class="w-full text-sm lg:w-80" data-testid="breakdown-table">
      <thead>
        <tr class="text-left text-xs font-medium text-muted">
          <th class="py-1">{{ t('dashboard.group') }}</th>
          <th class="py-1 text-right">{{ t('dashboard.actual') }}</th>
          <th class="py-1 text-right">{{ t('dashboard.target') }}</th>
          <th class="py-1 text-right">{{ t('dashboard.gap') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in rows"
          :key="row.group"
          class="border-t border-default"
          :data-testid="`breakdown-row-${row.group}`"
        >
          <td class="py-1">
            <span class="flex items-center gap-2">
              <DataDot :tone="row.group" />
              {{ row.name }}
            </span>
            <MoneyAmount :cents="row.actualCents" class="text-xs" />
          </td>
          <td class="py-1 text-right tabular-nums">
            {{ percent(row.actualPct) }} %
          </td>
          <td class="py-1 text-right tabular-nums">
            {{ percent(row.targetPct) }} %
          </td>
          <td
            class="py-1 text-right tabular-nums"
            :class="row.unfavourable ? 'text-warning' : 'text-default'"
            :data-unfavourable="row.unfavourable"
          >
            {{ row.gapPct > 0 ? '+' : '' }}{{ percent(row.gapPct) }} %
          </td>
        </tr>
      </tbody>
    </table>
    <p
      v-if="breakdown.toCategorizeCents > 0"
      class="text-xs text-muted lg:hidden"
    >
      {{
        t('dashboard.toCategorizeAmount', {
          amount: formatMoney(breakdown.toCategorizeCents),
        })
      }}
    </p>
  </div>
</template>
