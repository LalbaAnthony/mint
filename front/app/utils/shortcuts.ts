import type {
  ParsedShortcut,
  ShortcutDefinition,
  ShortcutHint,
  ShortcutId,
  ShortcutKeyEvent,
} from '~~/types/shortcuts'

export const desktopPointerQuery = '(hover: hover) and (pointer: fine)'

export const shortcutDefinitions: readonly ShortcutDefinition[] = [
  { id: 'search', keys: ['meta', 'k'], group: 'general', native: false },
  { id: 'create', keys: ['meta', 'alt', 'n'], group: 'general', native: false },
  { id: 'profile', keys: ['meta', ','], group: 'general', native: false },
  {
    id: 'amountMask',
    keys: ['meta', 'shift', 'm'],
    group: 'general',
    native: false,
  },
  { id: 'sidebar', keys: ['meta', 'b'], group: 'general', native: false },
  {
    id: 'notifications',
    keys: ['meta', 'shift', 'b'],
    group: 'general',
    native: false,
  },
  { id: 'help', keys: ['meta', '/'], group: 'general', native: false },
  { id: 'importFile', keys: ['meta', 'o'], group: 'views', native: false },
  {
    id: 'reorder',
    keys: ['meta', 'shift', 'o'],
    group: 'views',
    native: false,
  },
  { id: 'submit', keys: ['meta', 'enter'], group: 'forms', native: false },
  { id: 'close', keys: ['escape'], group: 'forms', native: true },
]

export const excludedShortcutKeys: readonly (readonly string[])[] = [
  ['meta', 'n'],
  ['meta', 't'],
  ['meta', 'w'],
  ['meta', 'tab'],
  ['meta', 'shift', 'n'],
  ['meta', 'shift', 't'],
  ['meta', 'shift', 'w'],
  ['meta', 'shift', 'tab'],
  ['meta', 'a'],
  ['meta', 'c'],
  ['meta', 'v'],
  ['meta', 'x'],
  ['meta', 'z'],
  ['meta', 'y'],
  ['meta', 'shift', 'z'],
  ['meta', 'r'],
  ['meta', 'shift', 'r'],
  ['meta', 'l'],
  ['meta', 'f'],
  ['meta', 'p'],
  ['meta', '+'],
  ['meta', '-'],
  ['meta', '='],
  ['meta', '0'],
  ['meta', 'shift', 'i'],
  ['meta', 'shift', 'j'],
  ['meta', 'shift', 'c'],
  ['meta', 'q'],
  ['meta', 'h'],
  ['meta', 'm'],
]

const overlayRoles = ['dialog', 'alertdialog', 'menu', 'listbox']

export const overlaySelector = overlayRoles
  .map((role) => `[role="${role}"][data-state="open"]`)
  .join(',')

const modifierKeys = new Set(['meta', 'alt', 'shift'])
const namedKeys = new Set(['enter', 'escape', 'tab'])
const letterPattern = /^[a-z]$/

const ariaKeyNames: Record<string, string> = {
  alt: 'Alt',
  shift: 'Shift',
  enter: 'Enter',
  escape: 'Escape',
  tab: 'Tab',
}

export function findShortcutDefinition(id: ShortcutId): ShortcutDefinition {
  const definition = shortcutDefinitions.find((entry) => entry.id === id)
  if (definition === undefined) {
    throw new Error(`Unknown shortcut: ${id}`)
  }
  return definition
}

export function parseShortcut(keys: readonly string[]): ParsedShortcut {
  const mainKeys = keys.filter((key) => !modifierKeys.has(key))
  const key = mainKeys[0]
  if (key === undefined || mainKeys.length > 1) {
    throw new Error(`A shortcut needs exactly one main key: ${keys.join('+')}`)
  }
  return {
    primary: keys.includes('meta'),
    alt: keys.includes('alt'),
    shift: keys.includes('shift'),
    key,
  }
}

function matchesPrimaryModifier(
  event: ShortcutKeyEvent,
  primary: boolean,
  macOS: boolean,
): boolean {
  if (!primary) {
    return !event.ctrlKey && !event.metaKey
  }
  return macOS
    ? event.metaKey && !event.ctrlKey
    : event.ctrlKey && !event.metaKey
}

export function matchesShortcut(
  event: ShortcutKeyEvent,
  shortcut: ParsedShortcut,
  macOS: boolean,
): boolean {
  if (!matchesPrimaryModifier(event, shortcut.primary, macOS)) {
    return false
  }
  if (event.altKey !== shortcut.alt) {
    return false
  }
  if (letterPattern.test(shortcut.key)) {
    if (event.shiftKey !== shortcut.shift) {
      return false
    }
    if (macOS && shortcut.alt) {
      return event.code === `Key${shortcut.key.toUpperCase()}`
    }
    return event.key.toLowerCase() === shortcut.key
  }
  if (namedKeys.has(shortcut.key)) {
    return (
      event.shiftKey === shortcut.shift &&
      event.key.toLowerCase() === shortcut.key
    )
  }
  return event.key === shortcut.key
}

const parsedDefinitions = shortcutDefinitions
  .filter((definition) => !definition.native)
  .map((definition) => ({ definition, parsed: parseShortcut(definition.keys) }))

export function findMatchingShortcut(
  event: ShortcutKeyEvent,
  macOS: boolean,
): ShortcutDefinition | undefined {
  return parsedDefinitions.find(({ parsed }) =>
    matchesShortcut(event, parsed, macOS),
  )?.definition
}

export function shortcutKbds(keys: readonly string[]): string[] {
  return keys.map((key) => (letterPattern.test(key) ? key.toUpperCase() : key))
}

export function shortcutAriaKeys(
  keys: readonly string[],
  macOS: boolean,
): string {
  return keys
    .map((key) => {
      if (key === 'meta') {
        return macOS ? 'Meta' : 'Control'
      }
      return ariaKeyNames[key] ?? key.toUpperCase()
    })
    .join('+')
}

export function shortcutHint(id: ShortcutId, macOS: boolean): ShortcutHint {
  const { keys } = findShortcutDefinition(id)
  return {
    kbds: shortcutKbds(keys),
    ariaKeyshortcuts: shortcutAriaKeys(keys, macOS),
  }
}

export function isOverlayOpen(root: ParentNode): boolean {
  return root.querySelector(overlaySelector) !== null
}

export function innermostContainer<T>(
  candidates: readonly T[],
  containerOf: (candidate: T) => HTMLElement,
): T | undefined {
  return candidates.reduce<T | undefined>((best, candidate) => {
    if (best === undefined) {
      return candidate
    }
    return containerOf(best).contains(containerOf(candidate)) ? candidate : best
  }, undefined)
}
