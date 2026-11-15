import type {
  AriaComponentOption,
  GridComponentOption,
  TooltipComponentOption,
} from 'echarts/components'
import type { LineSeriesOption } from 'echarts/charts'
import type { ComposeOption } from 'echarts/core'
import type { Account } from '@mint/shared/types/accounts'
import type {
  InvestmentSummary,
  Valuation,
} from '@mint/shared/types/valuations'
import type { ChartTheme } from './forecast'

export type ValuationFormState = {
  date: string
  value: string
}

export interface ValuationsModalProps {
  account: Account | null
}

export type ValuationsModalEmits = {
  changed: []
}

export interface InvestmentGainProps {
  summary: InvestmentSummary
}

export interface ValuationChartProps {
  valuations: Valuation[]
}

export type ValuationChartOption = ComposeOption<
  | LineSeriesOption
  | GridComponentOption
  | TooltipComponentOption
  | AriaComponentOption
>

export type ValuationChartOptionInput = {
  valuations: readonly Valuation[]
  theme: ChartTheme
  label: string
  animate: boolean
  formatters: {
    money: (cents: number) => string
    axisDate: (date: string) => string
    longDate: (date: string) => string
  }
}
