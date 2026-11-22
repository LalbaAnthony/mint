import { useEventListener } from '@vueuse/core'
import type { BottomSpaceExtension, VerticalSpan } from '~~/types/viewport'

const subPixelOffset = 1

const scopes = new Set<() => HTMLElement | null>()
const extensions = new Map<HTMLElement, BottomSpaceExtension>()
let pendingFrame: number | null = null

function ownsField(field: HTMLElement): boolean {
  const target = popoverAnchor(field) ?? field
  return [...scopes].some((root) => root()?.contains(target) === true)
}

function containerBox(container: HTMLElement): VerticalSpan {
  if (container === document.documentElement) {
    return { top: 0, bottom: window.innerHeight }
  }
  const rect = container.getBoundingClientRect()
  return { top: rect.top, bottom: rect.bottom }
}

function extendBottomSpace(container: HTMLElement, missing: number): void {
  const extension = extensions.get(container) ?? {
    inlinePadding: container.style.paddingBottom,
    basePadding:
      Number.parseFloat(getComputedStyle(container).paddingBottom) || 0,
    added: 0,
  }
  const previousPadding = container.style.paddingBottom
  const height = container.clientHeight
  const added = extension.added + missing
  container.style.paddingBottom = `${extension.basePadding + added}px`
  if (container.clientHeight !== height) {
    container.style.paddingBottom = previousPadding
    return
  }
  extensions.set(container, { ...extension, added })
}

function releaseBottomSpace(): void {
  for (const [container, extension] of extensions) {
    container.style.paddingBottom = extension.inlinePadding
  }
  extensions.clear()
}

function center(field: HTMLElement, viewport: VisualViewport): void {
  if (!field.isConnected) {
    return
  }
  const rect = field.getBoundingClientRect()
  if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
    return
  }
  const container = nearestScrollContainer(popoverAnchor(field) ?? field)
  const offset = centeringOffset(
    rect,
    visibleSpan(containerBox(container), viewport),
  )
  if (Math.abs(offset) < subPixelOffset) {
    return
  }
  const remaining =
    container.scrollHeight - container.clientHeight - container.scrollTop
  if (offset > remaining) {
    extendBottomSpace(container, Math.ceil(offset - remaining))
  }
  container.scrollTop += offset
}

function scheduleCentering(field: HTMLElement, viewport: VisualViewport): void {
  if (pendingFrame !== null) {
    cancelAnimationFrame(pendingFrame)
  }
  pendingFrame = requestAnimationFrame(() => {
    center(field, viewport)
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = null
      center(field, viewport)
    })
  })
}

export function useKeyboardCentering(): void {
  const viewport = window.visualViewport
  if (!viewport) {
    return
  }

  const keyboardOpen = (): boolean =>
    isVirtualKeyboardOpen(viewport, window.innerHeight)

  useEventListener(document, 'focusin', (event) => {
    const field = event.target
    if (keyboardOpen() && opensVirtualKeyboard(field) && ownsField(field)) {
      scheduleCentering(field, viewport)
    }
  })

  useEventListener(viewport, 'resize', () => {
    if (!keyboardOpen()) {
      releaseBottomSpace()
      return
    }
    const field = document.activeElement
    if (opensVirtualKeyboard(field) && ownsField(field)) {
      scheduleCentering(field, viewport)
    }
  })

  onScopeDispose(() => {
    if (pendingFrame !== null) {
      cancelAnimationFrame(pendingFrame)
      pendingFrame = null
    }
    releaseBottomSpace()
  })
}

export function useKeyboardCenteringScope(
  root: () => HTMLElement | null,
): void {
  onMounted(() => {
    scopes.add(root)
  })
  onBeforeUnmount(() => {
    scopes.delete(root)
  })
}
