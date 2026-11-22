import { useMediaQuery } from '@vueuse/core'
import type {
  ShortcutHint,
  ShortcutId,
  ShortcutRegistration,
} from '~~/types/shortcuts'

export const useShortcutsStore = defineStore('shortcuts', () => {
  const registrations = shallowRef<ShortcutRegistration[]>([])
  const active = useMediaQuery(desktopPointerQuery)
  const helpOpen = ref(false)
  const { macOS } = useKbd()

  const isMac = computed(() => Boolean(macOS.value))

  function register(registration: ShortcutRegistration): ShortcutRegistration {
    registrations.value = [...registrations.value, registration]
    return registration
  }

  function unregister(registration: ShortcutRegistration): void {
    registrations.value = registrations.value.filter(
      (entry) => entry !== registration,
    )
  }

  function pageWinner(id: ShortcutId): ShortcutRegistration | undefined {
    const candidates = registrations.value.filter(
      (entry) =>
        entry.shortcut === id &&
        entry.container === undefined &&
        entry.enabled(),
    )
    return (
      candidates.findLast((entry) => !entry.fallback) ??
      candidates.findLast((entry) => entry.fallback)
    )
  }

  function containerWinner(
    id: ShortcutId,
    focused: Element | null,
  ): ShortcutRegistration | undefined {
    if (focused === null) {
      return undefined
    }
    const candidates = registrations.value.flatMap((registration) => {
      if (registration.shortcut !== id || !registration.enabled()) {
        return []
      }
      const element = registration.container?.() ?? null
      return element !== null && element.contains(focused)
        ? [{ registration, element }]
        : []
    })
    return innermostContainer(candidates, (candidate) => candidate.element)
      ?.registration
  }

  function hint(id: ShortcutId): ShortcutHint | undefined {
    return active.value ? shortcutHint(id, isMac.value) : undefined
  }

  function hintFor(
    registration: ShortcutRegistration,
  ): ShortcutHint | undefined {
    if (registration.container === undefined) {
      return pageWinner(registration.shortcut) === registration
        ? hint(registration.shortcut)
        : undefined
    }
    return registration.enabled() ? hint(registration.shortcut) : undefined
  }

  function fallbackHint(id: ShortcutId): ShortcutHint | undefined {
    return pageWinner(id)?.fallback === true ? hint(id) : undefined
  }

  function resolve(id: ShortcutId): ShortcutRegistration | undefined {
    const contained = containerWinner(id, document.activeElement)
    if (contained !== undefined) {
      return contained
    }
    return isOverlayOpen(document) ? undefined : pageWinner(id)
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (
      !active.value ||
      event.repeat ||
      event.isComposing ||
      event.defaultPrevented
    ) {
      return
    }
    const definition = findMatchingShortcut(event, isMac.value)
    if (definition === undefined) {
      return
    }
    const registration = resolve(definition.id)
    if (registration === undefined) {
      return
    }
    event.preventDefault()
    registration.action()
  }

  return {
    registrations,
    active,
    helpOpen,
    register,
    unregister,
    hint,
    hintFor,
    fallbackHint,
    handleKeydown,
  }
})
