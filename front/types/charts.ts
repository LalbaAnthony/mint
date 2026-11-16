import type { registerLocale } from 'echarts/core'

export type ChartLocale = Parameters<typeof registerLocale>[1]

export type ChartLocaleName = 'FR' | 'EN'

export type ChartInitOptions = {
  renderer: 'svg'
  locale: ChartLocaleName
}
