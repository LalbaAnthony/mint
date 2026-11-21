import type {
  BarSeriesOption,
  LineSeriesOption,
  PieSeriesOption,
} from 'echarts/charts'
import type {
  AriaComponentOption,
  GraphicComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import type {
  BreakdownResponse,
  DashboardSummary,
  MonthlyReportResponse,
} from '@mint/shared/types/dashboard'
import type { ExpenseGroup } from '@mint/shared/types/categories'
import type { ChartTheme } from './forecast'

export type BreakdownGroup = ExpenseGroup | 'save'

export type BreakdownSlice = {
  id: string
  name: string
  valueCents: number
  color: string
  hatched: boolean
}

export type BreakdownRow = {
  group: BreakdownGroup
  name: string
  actualCents: number
  actualPct: number
  targetPct: number
  gapPct: number
  unfavourable: boolean
}

export type DonutChartOption = ComposeOption<
  | PieSeriesOption
  | TooltipComponentOption
  | AriaComponentOption
  | GraphicComponentOption
>

export type MonthlyChartOption = ComposeOption<
  | BarSeriesOption
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | LegendComponentOption
  | MarkLineComponentOption
  | AriaComponentOption
>

export type DonutOptionInput = {
  slices: BreakdownSlice[]
  totalLabel: string
  theme: ChartTheme
  money: (cents: number) => string
  percent: (value: number) => string
  animate: boolean
  ariaDescription: string | null
}

export type MonthlyLabels = {
  realIncome: string
  plannedIncome: string
  realExpense: string
  plannedExpense: string
  net: string
  today: string
}

export type MonthlyOptionInput = {
  report: MonthlyReportResponse
  theme: ChartTheme
  labels: MonthlyLabels
  money: (cents: number) => string
  monthLabel: (month: string) => string
  animate: boolean
  ariaDescription: string | null
}

export type BreakdownPeriodMode = 'month' | 'custom'

export interface DashboardBannerProps {
  summary: DashboardSummary
}

export interface BreakdownChartProps {
  breakdown: BreakdownResponse
}

export interface MonthlyChartProps {
  report: MonthlyReportResponse
}
