import type { AutofocusField, FieldValueLookup } from '~~/types/forms'

const focusableSelector =
  'input:not([type="hidden"]), textarea, select, button, [tabindex]'

export function lookupFieldValue(
  values: object,
  name: string,
): FieldValueLookup {
  let current: unknown = values
  for (const key of name.split('.')) {
    if (typeof current !== 'object' || current === null || !(key in current)) {
      return { tracked: false }
    }
    current = Reflect.get(current, key)
  }
  return { tracked: true, value: current }
}

export function isEmptyFieldValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function focusableControl(element: HTMLElement): HTMLElement | null {
  for (const candidate of element.querySelectorAll(focusableSelector)) {
    if (
      candidate instanceof HTMLElement &&
      candidate.tabIndex >= 0 &&
      !candidate.matches(':disabled') &&
      candidate.closest('[aria-hidden="true"]') === null
    ) {
      return candidate
    }
  }
  return null
}

function inDocumentOrder(first: HTMLElement, second: HTMLElement): number {
  return first.compareDocumentPosition(second) &
    Node.DOCUMENT_POSITION_FOLLOWING
    ? -1
    : 1
}

export function firstEmptyFieldControl(
  values: object,
  fields: readonly AutofocusField[],
): HTMLElement | null {
  const elements = fields.flatMap((field) => {
    const element = field.element()
    return element === null ? [] : [{ name: field.name(), element }]
  })
  elements.sort((first, second) =>
    inDocumentOrder(first.element, second.element),
  )
  for (const { name, element } of elements) {
    const lookup = lookupFieldValue(values, name)
    if (!lookup.tracked || !isEmptyFieldValue(lookup.value)) {
      continue
    }
    const control = focusableControl(element)
    if (control !== null) {
      return control
    }
  }
  return null
}
