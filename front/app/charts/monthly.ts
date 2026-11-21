import { chartAria } from '~/charts/aria'
import type { MonthlyChartOption, MonthlyOptionInput } from '~~/types/dashboard'

function hatch() {
  return {
    symbol: 'rect',
    dashArrayX: [1, 0],
    dashArrayY: [2, 5],
    rotation: -Math.PI / 4,
  }
}

function emptyAsDash(cents: number): number | '-' {
  return cents === 0 ? '-' : cents
}

export function monthlyOption({
  report,
  theme,
  labels,
  money,
  monthLabel,
  animate,
  ariaDescription,
}: MonthlyOptionInput): MonthlyChartOption {
  const months = report.months.map((month) => month.month)
  const barStyle = (color: string, planned: boolean) => ({
    color,
    decal: planned ? hatch() : { symbol: 'none' },
    opacity: planned ? 0.85 : 1,
  })
  return {
    animation: animate,
    animationDuration: 300,
    textStyle: { fontFamily: theme.fontFamily, fontSize: 12 },
    aria: chartAria(ariaDescription),
    grid: { left: 8, right: 16, top: 24, bottom: 56, containLabel: true },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: theme.textMuted },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.background,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontFamily: theme.fontFamily },
      valueFormatter: (value) =>
        typeof value === 'number' ? money(value) : '',
    },
    xAxis: {
      type: 'category',
      data: months,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: theme.borderMuted } },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 12,
        formatter: (value: string) => monthLabel(value),
      },
    },
    yAxis: {
      type: 'value',
      axisLabel: {
        color: theme.textMuted,
        fontSize: 12,
        formatter: (value: number) => money(value),
      },
      splitLine: { lineStyle: { color: theme.borderMuted } },
    },
    series: [
      {
        type: 'bar',
        name: labels.realIncome,
        stack: 'income',
        data: report.months.map((month) => emptyAsDash(month.real.incomeCents)),
        itemStyle: barStyle(theme.income, false),
        markLine: {
          symbol: 'none',
          silent: true,
          data: [
            {
              xAxis: report.currentMonth,
              lineStyle: { color: theme.textMuted, type: [4, 4], width: 1 },
              label: { formatter: labels.today, color: theme.textMuted },
            },
          ],
        },
      },
      {
        type: 'bar',
        name: labels.plannedIncome,
        stack: 'income',
        data: report.months.map((month) =>
          emptyAsDash(month.planned.incomeCents),
        ),
        itemStyle: barStyle(theme.income, true),
      },
      {
        type: 'bar',
        name: labels.realExpense,
        stack: 'expense',
        data: report.months.map((month) =>
          emptyAsDash(month.real.expenseCents),
        ),
        itemStyle: barStyle(theme.expense, false),
      },
      {
        type: 'bar',
        name: labels.plannedExpense,
        stack: 'expense',
        data: report.months.map((month) =>
          emptyAsDash(month.planned.expenseCents),
        ),
        itemStyle: barStyle(theme.expense, true),
      },
      {
        type: 'line',
        name: labels.net,
        data: report.months.map((month) => month.balanceCents),
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: theme.net, width: 2 },
        itemStyle: { color: theme.net, decal: { symbol: 'none' } },
      },
    ],
  }
}
