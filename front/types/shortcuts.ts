import type { MaybeRefOrGetter } from 'vue'

export type ShortcutId =
  | 'search'
  | 'create'
  | 'profile'
  | 'amountMask'
  | 'sidebar'
  | 'notifications'
  | 'help'
  | 'importFile'
  | 'reorder'
  | 'submit'
  | 'close'

export type ShortcutGroup = 'general' | 'views' | 'forms'

export interface ShortcutDefinition {
  id: ShortcutId
  keys: readonly string[]
  group: ShortcutGroup
  native: boolean
}

export interface ParsedShortcut {
  primary: boolean
  alt: boolean
  shift: boolean
  key: string
}

export interface ShortcutKeyEvent {
  key: string
  code: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

export interface ShortcutHint {
  kbds: string[]
  ariaKeyshortcuts: string
}

export interface ShortcutRegistration {
  shortcut: ShortcutId
  action: () => void
  enabled: () => boolean
  container: (() => HTMLElement | null) | undefined
  fallback: boolean
}

export interface ShortcutOptions {
  enabled?: MaybeRefOrGetter<boolean>
  container?: MaybeRefOrGetter<HTMLElement | null | undefined>
  fallback?: boolean
}

export interface ShortcutHintOptions {
  fallbackOnly?: boolean
}

export interface ShortcutTooltipProps {
  shortcut?: ShortcutId
  hint?: ShortcutHint
  text?: string
}

export interface ShortcutHelpRow {
  id: ShortcutId
  label: string
  kbds: string[]
}

export interface ShortcutHelpSection {
  group: ShortcutGroup
  title: string
  rows: ShortcutHelpRow[]
}
