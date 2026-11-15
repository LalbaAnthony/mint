import { useMutationObserver, usePreferredReducedMotion } from '@vueuse/core'
import { readChartTheme } from '~/charts/theme'

export function useChartTheme() {
  const root = document.documentElement
  const theme = shallowRef(readChartTheme(root))
  useMutationObserver(
    root,
    () => {
      theme.value = readChartTheme(root)
    },
    { attributes: true, attributeFilter: ['class'] },
  )
  const motion = usePreferredReducedMotion()
  const animate = computed(() => motion.value !== 'reduce')
  return { theme, animate }
}
