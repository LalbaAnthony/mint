import { tryOnScopeDispose } from '@vueuse/core'
import type { ComputedRef, MaybeRefOrGetter } from 'vue'
import type {
  ShortcutHint,
  ShortcutHintOptions,
  ShortcutId,
  ShortcutOptions,
} from '~~/types/shortcuts'

export function useShortcut(
  id: ShortcutId,
  action: () => void,
  options: ShortcutOptions = {},
): ComputedRef<ShortcutHint | undefined> {
  const shortcuts = useShortcutsStore()
  const { enabled = true, container, fallback = false } = options
  const registration = shortcuts.register({
    shortcut: id,
    action,
    enabled: () => toValue(enabled),
    container:
      container === undefined ? undefined : () => toValue(container) ?? null,
    fallback,
  })
  tryOnScopeDispose(() => shortcuts.unregister(registration))
  return computed(() => shortcuts.hintFor(registration))
}

export function useShortcutHint(
  id: MaybeRefOrGetter<ShortcutId | undefined>,
  options: ShortcutHintOptions = {},
): ComputedRef<ShortcutHint | undefined> {
  const shortcuts = useShortcutsStore()
  return computed(() => {
    const shortcut = toValue(id)
    if (shortcut === undefined) {
      return undefined
    }
    return options.fallbackOnly === true
      ? shortcuts.fallbackHint(shortcut)
      : shortcuts.hint(shortcut)
  })
}

export function useDialogSubmitShortcut(
  anchor: MaybeRefOrGetter<HTMLElement | null>,
  action: () => void,
  enabled: MaybeRefOrGetter<boolean>,
): void {
  useShortcut('submit', action, {
    enabled,
    container: () => {
      const dialog = toValue(anchor)?.closest('[role="dialog"]')
      return dialog instanceof HTMLElement ? dialog : null
    },
  })
}
