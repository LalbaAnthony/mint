import type { BreakdownResponse } from '@mint/shared/types/dashboard'
import type {
  BreakdownGroup,
  BreakdownRow,
  BreakdownSlice,
  DonutChartOption,
  DonutOptionInput,
} from '~~/types/dashboard'
import type { ChartTheme } from '~~/types/forecast'

const hatch = {
  symbol: 'rect',
  dashArrayX: [1, 0],
  dashArrayY: [2, 5],
  rotation: -Math.PI / 4,
}

export function groupTotals(
  breakdown: BreakdownResponse,
): Record<BreakdownGroup, number> {
  return {
    needs: breakdown.needs.totalCents,
    wants: breakdown.wants.totalCents,
    save: breakdown.saveCents,
  }
}

export function groupRows(
  breakdown: BreakdownResponse,
  names: Record<BreakdownGroup, string>,
): BreakdownRow[] {
  const totals = groupTotals(breakdown)
  const sum = totals.needs + totals.wants + totals.save
  const groups: BreakdownGroup[] = ['needs', 'wants', 'save']
  return groups.map((group) => {
    const actualPct =
      sum <= 0 ? 0 : Math.round((totals[group] / sum) * 1000) / 10
    const targetPct = breakdown.targets[group]
    const gapPct = Math.round((actualPct - targetPct) * 10) / 10
    return {
      group,
      name: names[group],
      actualCents: totals[group],
      actualPct,
      targetPct,
      gapPct,
      unfavourable: group === 'save' ? gapPct < 0 : gapPct > 0,
    }
  })
}

export function groupSlices(
  breakdown: BreakdownResponse,
  names: Record<BreakdownGroup, string>,
  theme: ChartTheme,
): BreakdownSlice[] {
  const totals = groupTotals(breakdown)
  const colors: Record<BreakdownGroup, string> = {
    needs: theme.needs,
    wants: theme.wants,
    save: theme.save,
  }
  const groups: BreakdownGroup[] = ['needs', 'wants', 'save']
  return groups.map((group) => ({
    id: group,
    name: names[group],
    valueCents: Math.max(0, totals[group]),
    color: colors[group],
    hatched: false,
  }))
}

export function categorySlices(
  breakdown: BreakdownResponse,
  group: 'needs' | 'wants',
  categoryName: (id: string) => string,
  categoryOrder: (id: string) => number,
  theme: ChartTheme,
): BreakdownSlice[] {
  const shades = group === 'needs' ? theme.needsShades : theme.wantsShades
  return [...breakdown[group].categories]
    .sort(
      (first, second) =>
        categoryOrder(first.categoryId) - categoryOrder(second.categoryId),
    )
    .map((category, index) => ({
      id: category.categoryId,
      name: categoryName(category.categoryId),
      valueCents: Math.max(0, category.totalCents),
      color: shades[index % shades.length] ?? theme.needs,
      hatched: index >= shades.length,
    }))
}

export function donutOption({
  slices,
  totalLabel,
  theme,
  money,
  animate,
}: DonutOptionInput): DonutChartOption {
  const total = slices.reduce((sum, slice) => sum + slice.valueCents, 0)
  return {
    animation: animate,
    animationDuration: 300,
    textStyle: { fontFamily: theme.fontFamily, fontSize: 12 },
    aria: { enabled: true, decal: { show: true } },
    tooltip: {
      trigger: 'item',
      backgroundColor: theme.background,
      borderColor: theme.border,
      textStyle: { color: theme.text, fontFamily: theme.fontFamily },
      formatter: (params) => {
        const item = Array.isArray(params) ? params[0] : params
        const value = typeof item?.value === 'number' ? item.value : 0
        return `${item?.name ?? ''} : ${money(value)}`
      },
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: `${totalLabel}\n${money(total)}`,
          fill: theme.text,
          fontSize: 14,
          fontWeight: 600,
          align: 'center',
        },
      },
    ],
    series: [
      {
        type: 'pie',
        radius: ['55%', '80%'],
        avoidLabelOverlap: true,
        label: {
          color: theme.textMuted,
          formatter: (params) => `${params.name} ${params.percent ?? 0} %`,
        },
        data: slices.map((slice) => ({
          id: slice.id,
          name: slice.name,
          value: slice.valueCents,
          itemStyle: {
            color: slice.color,
            decal: slice.hatched ? hatch : { symbol: 'none' },
          },
        })),
      },
    ],
  }
}
