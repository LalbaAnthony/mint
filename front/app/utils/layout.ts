import type { ChartHeight } from '~~/types/skeleton'

export const touchIconButtonClass = 'max-lg:size-11 max-lg:justify-center'

export const scrollableRadioGroupUi = {
  fieldset: 'min-w-0 overflow-x-auto p-1 -ms-1 -mb-1',
  legend: 'mb-0',
}

export const chartHeights = {
  balanceCurve: { mobile: 240, desktop: 320 },
  monthly: { mobile: 240, desktop: 320 },
  breakdown: { mobile: 280, desktop: 280 },
  valuation: { mobile: 200, desktop: 200 },
} as const satisfies Record<string, ChartHeight>
