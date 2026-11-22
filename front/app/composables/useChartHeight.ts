import { useMediaQuery } from '@vueuse/core'
import type { ChartHeight } from '~~/types/skeleton'

export function useChartHeight(height: ChartHeight) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  return computed(() => `${isDesktop.value ? height.desktop : height.mobile}px`)
}
