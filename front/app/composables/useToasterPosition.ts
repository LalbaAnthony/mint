import { useMediaQuery } from '@vueuse/core'
import type { ToasterPosition } from '~~/types/toaster'

export function useToasterPosition() {
  const isDesktop = useMediaQuery('(min-width: 1024px)')

  return computed<ToasterPosition>(() =>
    isDesktop.value ? 'bottom-right' : 'top-center',
  )
}
