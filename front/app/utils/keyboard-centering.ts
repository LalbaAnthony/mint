import type { VerticalSpan, ViewportGeometry } from '~~/types/viewport'

const minimumKeyboardHeight = 100
const scaleTolerance = 0.01

const keyboardInputTypes = new Set([
  'text',
  'search',
  'email',
  'tel',
  'url',
  'password',
  'number',
])

const scrollableOverflows = new Set(['auto', 'scroll', 'overlay'])

function isEditable(element: HTMLInputElement | HTMLTextAreaElement): boolean {
  return (
    !element.disabled &&
    !element.readOnly &&
    element.getAttribute('inputmode') !== 'none'
  )
}

export function opensVirtualKeyboard(
  element: EventTarget | null,
): element is HTMLInputElement | HTMLTextAreaElement {
  if (element instanceof HTMLTextAreaElement) {
    return isEditable(element)
  }
  return (
    element instanceof HTMLInputElement &&
    keyboardInputTypes.has(element.type) &&
    isEditable(element)
  )
}

export function isAtDefaultScale(viewport: ViewportGeometry): boolean {
  return Math.abs(viewport.scale - 1) <= scaleTolerance
}

export function isVirtualKeyboardOpen(
  viewport: ViewportGeometry,
  layoutHeight: number,
): boolean {
  return (
    isAtDefaultScale(viewport) &&
    layoutHeight - viewport.height >= minimumKeyboardHeight
  )
}

export function visibleSpan(
  box: VerticalSpan,
  viewport: ViewportGeometry,
): VerticalSpan {
  return {
    top: Math.max(box.top, viewport.offsetTop),
    bottom: Math.min(box.bottom, viewport.offsetTop + viewport.height),
  }
}

export function centeringOffset(
  field: VerticalSpan,
  visible: VerticalSpan,
): number {
  return (field.top + field.bottom) / 2 - (visible.top + visible.bottom) / 2
}

function commonAncestor(first: Element, second: Element): Element | null {
  for (
    let ancestor = first.parentElement;
    ancestor !== null;
    ancestor = ancestor.parentElement
  ) {
    if (ancestor.contains(second)) {
      return ancestor
    }
  }
  return null
}

export function popoverAnchor(field: Element): HTMLElement | null {
  const controllers = document.querySelectorAll(
    '[aria-controls][aria-expanded="true"]',
  )
  for (const controller of controllers) {
    const id = controller.getAttribute('aria-controls')
    const controlled = id === null ? null : document.getElementById(id)
    if (
      !(controller instanceof HTMLElement) ||
      controller === field ||
      controlled === null
    ) {
      continue
    }
    const popover = commonAncestor(field, controlled)
    if (popover !== null && !popover.contains(controller)) {
      return controller
    }
  }
  return null
}

export function nearestScrollContainer(element: Element): HTMLElement {
  for (
    let ancestor = element.parentElement;
    ancestor !== null;
    ancestor = ancestor.parentElement
  ) {
    if (scrollableOverflows.has(getComputedStyle(ancestor).overflowY)) {
      return ancestor
    }
  }
  return document.documentElement
}
