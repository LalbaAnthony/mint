import type {
  ValuationChartOption,
  ValuationChartOptionInput,
} from '~~/types/valuations'

export function valuationSeries(
  valuations: ValuationChartOptionInput['valuations'],
): [string, number][] {
  return [...valuations]
    .sort((first, second) => first.date.localeCompare(second.date))
    .map((valuation) => [valuation.date, valuation.valueCents])
}

export function valuationChartOption({
  valuations,
  theme,
  label,
  animate,
  formatters,
}: ValuationChartOptionInput): ValuationChartOption {
  const points = valuationSeries(valuations)
  const valueByDate = new Map(points)
  return {
    animation: animate,
    animationDuration: 300,
    textStyle: { fontFamily: theme.fontFamily, fontSize: 12 },
    aria: { enabled: true, decal: { show: true } },
    grid: { left: 8, right: 16, top: 16, bottom: 8, containLabel: true },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.background,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontFamily: theme.fontFamily },
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params
        const value: unknown = first?.value
        const date =
          Array.isArray(value) && typeof value[0] === 'string' ? value[0] : ''
        const cents = valueByDate.get(date)
        return cents === undefined
          ? formatters.longDate(date)
          : `${formatters.longDate(date)}<br/>${label} : ${formatters.money(cents)}`
      },
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: theme.borderMuted } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 12,
        hideOverlap: true,
        formatter: (value: number) =>
          formatters.axisDate(new Date(value).toISOString().slice(0, 10)),
      },
    },
    yAxis: {
      type: 'value',
      scale: true,
      axisLabel: {
        color: theme.textMuted,
        fontSize: 12,
        formatter: (value: number) => formatters.money(value),
      },
      splitLine: { lineStyle: { color: theme.borderMuted } },
    },
    series: [
      {
        type: 'line',
        name: label,
        data: points,
        showSymbol: true,
        symbol: 'circle',
        symbolSize: 8,
        lineStyle: { width: 2, type: 'solid' },
        itemStyle: { color: theme.investment, decal: { symbol: 'none' } },
      },
    ],
  }
}
