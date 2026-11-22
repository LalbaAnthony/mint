import { useEventListener } from '@vueuse/core'

const visibleTopProperty = '--app-visible-top'
const visibleHeightProperty = '--app-visible-height'

export function useVisibleViewport(): void {
  const viewport = window.visualViewport
  if (!viewport) {
    return
  }
  const style = document.documentElement.style

  function clear(): void {
    style.removeProperty(visibleTopProperty)
    style.removeProperty(visibleHeightProperty)
  }

  function update(geometry: VisualViewport): void {
    if (!isAtDefaultScale(geometry)) {
      clear()
      return
    }
    style.setProperty(visibleTopProperty, `${geometry.offsetTop}px`)
    style.setProperty(visibleHeightProperty, `${geometry.height}px`)
  }

  update(viewport)
  useEventListener(viewport, 'resize', () => update(viewport))
  useEventListener(viewport, 'scroll', () => update(viewport))
  onScopeDispose(clear)
}
