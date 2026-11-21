import type { BalanceCurvePoint } from '@mint/shared/types/forecast'
import { chartAria } from '~/charts/aria'
import type {
  BalanceCurveChartOption,
  BalanceCurveOptionInput,
  ChartTheme,
} from '~~/types/forecast'

const emptyValue = '-'

function forecastDecal() {
  return {
    symbol: 'rect',
    dashArrayX: [1, 0],
    dashArrayY: [2, 5],
    rotation: -Math.PI / 4,
  }
}

function valueOf(point: BalanceCurvePoint | undefined): number | '-' {
  return point === undefined || point.balanceCents === null
    ? emptyValue
    : point.balanceCents
}

function pieces(theme: ChartTheme, thresholdCents: number | null) {
  if (thresholdCents === null || thresholdCents <= 0) {
    return [
      { lt: 0, color: theme.negative },
      { gte: 0, color: theme.balance },
    ]
  }
  return [
    { lt: 0, color: theme.negative },
    { gte: 0, lt: thresholdCents, color: theme.threshold },
    { gte: thresholdCents, color: theme.balance },
  ]
}

export function balanceCurveSeries(points: readonly BalanceCurvePoint[]) {
  const lastRealIndex = points.findLastIndex((point) => !point.forecast)
  return {
    dates: points.map((point) => point.date),
    real: points.map((point) => (point.forecast ? emptyValue : valueOf(point))),
    forecast: points.map((point, index) =>
      point.forecast || index === lastRealIndex ? valueOf(point) : emptyValue,
    ),
  }
}

export function balanceCurveOption({
  curve,
  theme,
  labels,
  formatters,
  animate,
  ariaDescription,
}: BalanceCurveOptionInput): BalanceCurveChartOption {
  const { dates, real, forecast } = balanceCurveSeries(curve.points)
  const byDate = new Map(curve.points.map((point) => [point.date, point]))
  const thresholdLine =
    curve.thresholdCents === null
      ? []
      : [
          {
            yAxis: curve.thresholdCents,
            name: labels.threshold,
            lineStyle: { color: theme.threshold, type: [6, 4], width: 1 },
            label: {
              formatter: labels.threshold,
              color: theme.textMuted,
              position: 'insideEndTop' as const,
            },
          },
        ]
  const minimum = curve.indicators
  return {
    animation: animate,
    animationDuration: 300,
    textStyle: { fontFamily: theme.fontFamily, fontSize: 12 },
    aria: chartAria(ariaDescription),
    grid: { left: 8, right: 16, top: 32, bottom: 40, containLabel: true },
    legend: {
      bottom: 0,
      icon: 'circle',
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: theme.textMuted },
      data: [labels.real, labels.forecast],
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: theme.background,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontFamily: theme.fontFamily },
      formatter: (params) => {
        const first = Array.isArray(params) ? params[0] : params
        const date = typeof first?.name === 'string' ? first.name : ''
        const point = byDate.get(date)
        if (point === undefined || point.balanceCents === null) {
          return formatters.longDate(date)
        }
        const series = point.forecast ? labels.forecast : labels.real
        return `${formatters.longDate(date)}<br/>${series} : ${formatters.money(point.balanceCents)}`
      },
    },
    xAxis: {
      type: 'category',
      data: dates,
      boundaryGap: false,
      axisLine: { lineStyle: { color: theme.borderMuted } },
      axisTick: { show: false },
      axisLabel: {
        color: theme.textMuted,
        fontSize: 12,
        formatter: (value: string) => formatters.axisDate(value),
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
    visualMap: {
      type: 'piecewise',
      show: false,
      dimension: 1,
      seriesIndex: [0, 1],
      pieces: pieces(theme, curve.thresholdCents),
    },
    series: [
      {
        type: 'line',
        name: labels.real,
        data: real,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, type: 'solid' },
        areaStyle: { opacity: 0.12 },
        itemStyle: { color: theme.balance, decal: { symbol: 'none' } },
      },
      {
        type: 'line',
        name: labels.forecast,
        data: forecast,
        showSymbol: false,
        connectNulls: false,
        lineStyle: { width: 2, type: [6, 4] },
        areaStyle: { opacity: 0.06 },
        itemStyle: { color: theme.balance, decal: forecastDecal() },
        markLine: {
          symbol: 'none',
          silent: true,
          data: [
            {
              xAxis: curve.today,
              name: labels.today,
              lineStyle: { color: theme.textMuted, type: [4, 4], width: 1 },
              label: {
                formatter: labels.today,
                color: theme.textMuted,
                position: 'end',
              },
            },
            ...thresholdLine,
          ],
        },
        markPoint:
          minimum === null
            ? undefined
            : {
                symbol: 'circle',
                symbolSize: 8,
                itemStyle: { color: theme.text },
                label: {
                  show: true,
                  position: 'bottom',
                  color: theme.text,
                  formatter: `${labels.minimum}\n${formatters.longDate(minimum.minBalanceDate)}\n${formatters.money(minimum.minBalanceCents)}`,
                },
                data: [
                  {
                    name: labels.minimum,
                    coord: [minimum.minBalanceDate, minimum.minBalanceCents],
                  },
                ],
              },
      },
    ],
  }
}
