import type { LineSeriesOption } from 'echarts/charts'
import type {
  AriaComponentOption,
  GridComponentOption,
  LegendComponentOption,
  MarkLineComponentOption,
  MarkPointComponentOption,
  TooltipComponentOption,
  VisualMapComponentOption,
} from 'echarts/components'
import type { ComposeOption } from 'echarts/core'
import type {
  BalanceCurveResponse,
  CalendarDay,
  CalendarOccurrence,
} from '@mint/shared/types/forecast'
import type { Schedule } from '@mint/shared/types/schedules'

export type ChartTheme = {
  needs: string
  wants: string
  save: string
  needsShades: string[]
  wantsShades: string[]
  balance: string
  threshold: string
  negative: string
  income: string
  expense: string
  net: string
  textMuted: string
  borderMuted: string
  border: string
  background: string
  text: string
  fontFamily: string
}

export type ChartToken = keyof Omit<
  ChartTheme,
  'fontFamily' | 'needsShades' | 'wantsShades'
>

export type BalanceCurveLabels = {
  real: string
  forecast: string
  today: string
  threshold: string
  minimum: string
}

export type BalanceCurveFormatters = {
  money: (cents: number) => string
  axisDate: (date: string) => string
  longDate: (date: string) => string
}

export type BalanceCurveOptionInput = {
  curve: BalanceCurveResponse
  theme: ChartTheme
  labels: BalanceCurveLabels
  formatters: BalanceCurveFormatters
  animate: boolean
}

export type ForecastScopeValue = string

export interface BalanceCurveChartProps {
  curve: BalanceCurveResponse
}

export type CalendarCell = {
  date: string
  inMonth: boolean
  day: CalendarDay | null
  nonWorking: boolean
}

export type CalendarDotKind = 'credit' | 'debit' | 'manual'

export type CalendarAlert = 'none' | 'belowThreshold' | 'negative'

export interface CalendarGridProps {
  cells: CalendarCell[]
  today: string
  selectedDate: string | null
  thresholdCents: number | null
  compact: boolean
}

export type CalendarGridEmits = {
  select: [date: string]
  occurrenceAction: [action: CalendarOccurrenceAction]
}

export interface CalendarDayDetailProps {
  day: CalendarDay
  thresholdCents: number | null
  aggregate: boolean
}

export type CalendarOccurrenceAction = {
  kind: 'edit' | 'skip' | 'restore' | 'openSchedule'
  occurrence: CalendarOccurrence
}

export type CalendarDayDetailEmits = {
  occurrenceAction: [action: CalendarOccurrenceAction]
}

export interface CalendarOccurrenceMenuProps {
  occurrence: CalendarOccurrence
}

export type CalendarOccurrenceMenuEmits = {
  action: [action: CalendarOccurrenceAction]
}

export type ScheduleLookup = (scheduleId: string) => Schedule | null

export type BalanceCurveChartOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | VisualMapComponentOption
  | MarkLineComponentOption
  | MarkPointComponentOption
  | LegendComponentOption
  | AriaComponentOption
>

export type ChartTableRow = {
  date: string
  balanceCents: number | null
  forecast: boolean
}
