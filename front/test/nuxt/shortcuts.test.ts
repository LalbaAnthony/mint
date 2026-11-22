import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive, ref } from 'vue'
import type { ComputedRef } from 'vue'
import type { ShortcutHint, ShortcutKeyEvent } from '~~/types/shortcuts'
import AmountMaskToggle from '~/components/AmountMaskToggle.vue'
import AppForm from '~/components/AppForm.vue'
import ConfirmModal from '~/components/ConfirmModal.vue'
import ShortcutHelpModal from '~/components/ShortcutHelpModal.vue'
import AccountsPage from '~/pages/accounts/index.vue'
import {
  excludedShortcutKeys,
  findMatchingShortcut,
  innermostContainer,
  parseShortcut,
  shortcutAriaKeys,
  shortcutDefinitions,
  shortcutKbds,
} from '~/utils/shortcuts'
import { mountInApp } from '../app'
import { installFakeApi } from '../fake-api'
import { findInBody, setViewportWidth } from '../planning-fixtures'

const { fetchMock, navigateToMock } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  navigateToMock: vi.fn(() => Promise.resolve()),
}))

mockNuxtImport('$fetch', () => fetchMock)
mockNuxtImport('navigateTo', () => navigateToMock)

const initialWidth = window.innerWidth
const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  fetchMock.mockReset()
  navigateToMock.mockClear()
})

afterEach(() => {
  mounted.splice(0).forEach((wrapper) => wrapper.unmount())
  document.body
    .querySelectorAll('[data-testid="fake-overlay"]')
    .forEach((element) => element.remove())
  useQuickAddStore().menuOpen = false
  useQuickAddStore().drawerOpen = false
  useSearchStore().closeModal()
  useNotificationsStore().open = false
  useShortcutsStore().helpOpen = false
  useConnectivityStore().backOnline()
  setViewportWidth(initialWidth)
})

function keyEvent(init: Partial<ShortcutKeyEvent>): ShortcutKeyEvent {
  return {
    key: '',
    code: '',
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    ...init,
  }
}

function matchedId(init: Partial<ShortcutKeyEvent>, macOS = false) {
  return findMatchingShortcut(keyEvent(init), macOS)?.id
}

function press(init: KeyboardEventInit, target?: Element): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    bubbles: true,
    cancelable: true,
    ...init,
  })
  ;(target ?? document.activeElement ?? document.body).dispatchEvent(event)
  return event
}

function host(setup: () => void, render: () => ReturnType<typeof h>) {
  return defineComponent({
    setup() {
      setup()
      return render
    },
  })
}

async function mountHost(
  setup: () => void,
  render: () => ReturnType<typeof h> = () => h('div'),
) {
  const wrapper = await mountInApp(host(setup, render), {
    attachTo: document.body,
  })
  mounted.push(wrapper)
  return wrapper
}

function openFakeOverlay(role: string): void {
  const overlay = document.createElement('div')
  overlay.setAttribute('role', role)
  overlay.setAttribute('data-state', 'open')
  overlay.setAttribute('data-testid', 'fake-overlay')
  document.body.append(overlay)
}

function setTouchPoints(count: number): void {
  const happyDOM: unknown = Reflect.get(window, 'happyDOM')
  const settings: unknown =
    typeof happyDOM === 'object' && happyDOM !== null
      ? Reflect.get(happyDOM, 'settings')
      : undefined
  const navigatorSettings: unknown =
    typeof settings === 'object' && settings !== null
      ? Reflect.get(settings, 'navigator')
      : undefined
  if (typeof navigatorSettings !== 'object' || navigatorSettings === null) {
    throw new Error('The front tests require the happy-dom environment')
  }
  window.dispatchEvent(new Event('resize'))
  Reflect.set(navigatorSettings, 'maxTouchPoints', count)
  window.dispatchEvent(new Event('resize'))
}

describe('shortcut catalogue (RAC-08)', () => {
  function signature(keys: readonly string[]): string {
    return [...keys].sort().join('+')
  }

  it('declares each key combination once', () => {
    const signatures = shortcutDefinitions.map(({ keys }) => signature(keys))
    expect(new Set(signatures).size).toBe(signatures.length)
  })

  it('uses no key reserved by the browsers, the editing or macOS', () => {
    const excluded = new Set(excludedShortcutKeys.map(signature))
    expect(
      shortcutDefinitions.filter(({ keys }) => excluded.has(signature(keys))),
    ).toEqual([])
  })

  it('gives every shortcut exactly one main key', () => {
    for (const { keys } of shortcutDefinitions) {
      expect(() => parseShortcut(keys)).not.toThrow()
    }
    expect(() => parseShortcut(['meta', 'k', 'j'])).toThrow()
    expect(() => parseShortcut(['meta', 'shift'])).toThrow()
  })
})

describe('key matching (ADR 0035)', () => {
  it('reads Ctrl outside macOS and Cmd on macOS, exclusively', () => {
    expect(matchedId({ key: 'k', code: 'KeyK', ctrlKey: true })).toBe('search')
    expect(matchedId({ key: 'k', code: 'KeyK', metaKey: true })).toBeUndefined()
    expect(matchedId({ key: 'k', code: 'KeyK', metaKey: true }, true)).toBe(
      'search',
    )
    expect(
      matchedId({ key: 'k', code: 'KeyK', ctrlKey: true }, true),
    ).toBeUndefined()
    expect(
      matchedId({ key: 'k', code: 'KeyK', ctrlKey: true, metaKey: true }),
    ).toBeUndefined()
    expect(matchedId({ key: 'k', code: 'KeyK' })).toBeUndefined()
  })

  it('compares letters to the typed character, whatever the layout', () => {
    expect(
      matchedId({ key: 'M', code: 'Semicolon', ctrlKey: true, shiftKey: true }),
    ).toBe('amountMask')
    expect(
      matchedId({ key: 'm', code: 'Semicolon', ctrlKey: true }),
    ).toBeUndefined()
    expect(
      matchedId({ key: 'K', code: 'KeyK', ctrlKey: true, shiftKey: true }),
    ).toBeUndefined()
  })

  it('leaves AltGr characters to the typing and reads the key position under Option', () => {
    expect(
      matchedId({ key: 'n', code: 'KeyN', ctrlKey: true, altKey: true }),
    ).toBe('create')
    expect(
      matchedId({ key: 'ń', code: 'KeyN', ctrlKey: true, altKey: true }),
    ).toBeUndefined()
    expect(
      matchedId(
        { key: 'Dead', code: 'KeyN', metaKey: true, altKey: true },
        true,
      ),
    ).toBe('create')
  })

  it('accepts Shift for symbols typed with Shift on some layouts', () => {
    expect(matchedId({ key: '/', code: 'Slash', ctrlKey: true })).toBe('help')
    expect(
      matchedId({ key: '/', code: 'Period', ctrlKey: true, shiftKey: true }),
    ).toBe('help')
    expect(matchedId({ key: ',', code: 'KeyM', ctrlKey: true })).toBe('profile')
  })

  it('compares Shift strictly for named keys', () => {
    expect(matchedId({ key: 'Enter', code: 'Enter', ctrlKey: true })).toBe(
      'submit',
    )
    expect(
      matchedId({
        key: 'Enter',
        code: 'Enter',
        ctrlKey: true,
        shiftKey: true,
      }),
    ).toBeUndefined()
    expect(matchedId({ key: 'Escape', code: 'Escape' })).toBeUndefined()
  })
})

describe('shortcut hints (RAC-07)', () => {
  it('formats the pastilles and aria-keyshortcuts per platform', () => {
    expect(shortcutKbds(['meta', 'alt', 'n'])).toEqual(['meta', 'alt', 'N'])
    expect(shortcutAriaKeys(['meta', 'alt', 'n'], false)).toBe('Control+Alt+N')
    expect(shortcutAriaKeys(['meta', 'alt', 'n'], true)).toBe('Meta+Alt+N')
    expect(shortcutAriaKeys(['meta', 'shift', 'm'], false)).toBe(
      'Control+Shift+M',
    )
    expect(shortcutAriaKeys(['meta', 'enter'], false)).toBe('Control+Enter')
    expect(shortcutAriaKeys(['meta', '/'], false)).toBe('Control+/')
  })

  it('picks the innermost container', () => {
    const outer = document.createElement('div')
    const inner = document.createElement('div')
    outer.append(inner)

    expect(
      innermostContainer(['outer', 'inner'], (name) =>
        name === 'outer' ? outer : inner,
      ),
    ).toBe('inner')
    expect(
      innermostContainer(['inner', 'outer'], (name) =>
        name === 'outer' ? outer : inner,
      ),
    ).toBe('inner')
    expect(innermostContainer([], () => outer)).toBeUndefined()
  })
})

describe('dispatch (ADR 0035)', () => {
  it('runs the action and takes the key from the browser', async () => {
    const action = vi.fn()
    await mountHost(() => useShortcut('search', action))

    const event = press({ key: 'k', code: 'KeyK', ctrlKey: true })

    expect(action).toHaveBeenCalledOnce()
    expect(event.defaultPrevented).toBe(true)
  })

  it('ignores repeated, composing and already handled keys', async () => {
    const action = vi.fn()
    await mountHost(() => useShortcut('search', action))
    const combination = { key: 'k', code: 'KeyK', ctrlKey: true }

    press({ ...combination, repeat: true })
    press({ ...combination, isComposing: true })
    const handled = new KeyboardEvent('keydown', {
      ...combination,
      bubbles: true,
      cancelable: true,
    })
    handled.preventDefault()
    document.body.dispatchEvent(handled)

    expect(action).not.toHaveBeenCalled()
  })

  it('leaves the key to the browser when the control is disabled (RAC-06)', async () => {
    const action = vi.fn()
    const enabled = ref(false)
    await mountHost(() => useShortcut('search', action, { enabled }))

    const event = press({ key: 'k', code: 'KeyK', ctrlKey: true })
    expect(action).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)

    enabled.value = true
    press({ key: 'k', code: 'KeyK', ctrlKey: true })
    expect(action).toHaveBeenCalledOnce()
  })

  it('prefers the action of the view to the fallback, then returns to it', async () => {
    const fallback = vi.fn()
    const view = vi.fn()
    const hints: Record<string, ComputedRef<ShortcutHint | undefined>> = {}
    const viewHost = await mountHost(() => {
      hints.view = useShortcut('create', view)
    })
    await mountHost(() => {
      hints.fallback = useShortcut('create', fallback, { fallback: true })
      hints.sidebar = useShortcutHint('create', { fallbackOnly: true })
    })
    const combination = { key: 'n', code: 'KeyN', ctrlKey: true, altKey: true }

    press(combination)
    expect(view).toHaveBeenCalledOnce()
    expect(fallback).not.toHaveBeenCalled()
    expect(hints.view?.value).toMatchObject({
      ariaKeyshortcuts: 'Control+Alt+N',
    })
    expect(hints.fallback?.value).toBeUndefined()
    expect(hints.sidebar?.value).toBeUndefined()

    viewHost.unmount()
    press(combination)
    expect(fallback).toHaveBeenCalledOnce()
    expect(view).toHaveBeenCalledOnce()
    expect(hints.sidebar?.value).toMatchObject({
      kbds: ['meta', 'alt', 'N'],
    })
  })

  it('suspends the view and global shortcuts while an overlay is open', async () => {
    const action = vi.fn()
    await mountHost(() => useShortcut('search', action))

    openFakeOverlay('tooltip')
    press({ key: 'k', code: 'KeyK', ctrlKey: true })
    expect(action).toHaveBeenCalledOnce()

    for (const role of ['dialog', 'alertdialog', 'menu', 'listbox']) {
      openFakeOverlay(role)
      const event = press({ key: 'k', code: 'KeyK', ctrlKey: true })
      expect(event.defaultPrevented).toBe(false)
      document.body
        .querySelectorAll('[data-testid="fake-overlay"]')
        .forEach((element) => element.remove())
    }
    expect(action).toHaveBeenCalledOnce()
  })

  it('runs the shortcut of the innermost container holding the focus', async () => {
    const outerAction = vi.fn()
    const innerAction = vi.fn()
    const outer = ref<HTMLElement | null>(null)
    const inner = ref<HTMLElement | null>(null)
    await mountHost(
      () => {
        useShortcut('submit', outerAction, { container: outer })
        useShortcut('submit', innerAction, { container: inner })
      },
      () =>
        h('div', { ref: outer }, [
          h('button', { 'data-testid': 'outer-button' }),
          h('div', { ref: inner }, [
            h('button', { 'data-testid': 'inner-button' }),
          ]),
        ]),
    )
    openFakeOverlay('dialog')

    findInBody('[data-testid="inner-button"]')?.focus()
    press({ key: 'Enter', code: 'Enter', ctrlKey: true })
    findInBody('[data-testid="outer-button"]')?.focus()
    press({ key: 'Enter', code: 'Enter', ctrlKey: true })
    findInBody('[data-testid="outer-button"]')?.blur()
    press({ key: 'Enter', code: 'Enter', ctrlKey: true }, document.body)

    expect(innerAction).toHaveBeenCalledOnce()
    expect(outerAction).toHaveBeenCalledOnce()
  })
})

describe('device without a precise pointer (RAC-01)', () => {
  afterEach(() => {
    setTouchPoints(0)
  })

  it('neither listens to the keys nor shows any shortcut', async () => {
    const action = vi.fn()
    await mountHost(() => useShortcut('search', action))
    const wrapper = await mountInApp(AmountMaskToggle)
    mounted.push(wrapper)

    setTouchPoints(5)
    await vi.waitFor(() => {
      expect(useShortcutsStore().active).toBe(false)
    })
    const event = press({ key: 'k', code: 'KeyK', ctrlKey: true })

    expect(action).not.toHaveBeenCalled()
    expect(event.defaultPrevented).toBe(false)
    const toggle = wrapper.get('[data-testid="amount-mask-toggle"]')
    expect(toggle.attributes('title')).toBe('Masquer les montants')
    expect(toggle.attributes('aria-keyshortcuts')).toBeUndefined()
  })
})

describe('global shortcuts (RAC-02, RAC-03)', () => {
  async function mountGlobal() {
    return mountHost(
      () => useGlobalShortcuts(),
      () => h(ShortcutHelpModal),
    )
  }

  it('opens the search, the notifications and the profile, and toggles the masked mode', async () => {
    await mountGlobal()
    const masked = useAmountMaskStore().masked

    press({ key: 'k', code: 'KeyK', ctrlKey: true })
    expect(useSearchStore().modalOpen).toBe(true)
    useSearchStore().closeModal()

    press({ key: 'B', code: 'KeyB', ctrlKey: true, shiftKey: true })
    expect(useNotificationsStore().open).toBe(true)
    useNotificationsStore().open = false

    press({ key: 'M', code: 'Semicolon', ctrlKey: true, shiftKey: true })
    expect(useAmountMaskStore().masked).toBe(!masked)
    useAmountMaskStore().toggle()

    press({ key: ',', code: 'Comma', ctrlKey: true })
    expect(navigateToMock).toHaveBeenCalledWith('/profile')
  })

  it('lists every shortcut in the help modal opened by Ctrl+/', async () => {
    await mountGlobal()

    press({ key: '/', code: 'Period', ctrlKey: true, shiftKey: true })

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="shortcut-help"]')).not.toBeNull()
    })
    const help = findInBody('[data-testid="shortcut-help"]')
    expect(
      [...(help?.querySelectorAll('h3') ?? [])].map((title) =>
        title.textContent.trim(),
      ),
    ).toEqual(['Général', 'Vues', 'Formulaires'])
    for (const { id } of shortcutDefinitions) {
      expect(
        help?.querySelector(`[data-testid="shortcut-help-${id}"]`),
      ).not.toBeNull()
    }
    expect(
      help?.querySelector('[data-testid="shortcut-help-create"]')?.textContent,
    ).toContain('Ctrl')
  })

  it('opens the Add menu of the sidebar on desktop and the drawer of the button below', async () => {
    await mountGlobal()
    const combination = { key: 'n', code: 'KeyN', ctrlKey: true, altKey: true }

    setViewportWidth(1280)
    press(combination)
    expect(useQuickAddStore().menuOpen).toBe(true)
    expect(useQuickAddStore().drawerOpen).toBe(false)
    useQuickAddStore().menuOpen = false

    setViewportWidth(800)
    press(combination)
    expect(useQuickAddStore().drawerOpen).toBe(true)
    expect(useQuickAddStore().menuOpen).toBe(false)
  })

  it('does nothing offline for the search and the creation (NF-PWA-02)', async () => {
    await mountGlobal()
    useConnectivityStore().wentOffline()

    const search = press({ key: 'k', code: 'KeyK', ctrlKey: true })
    const create = press({
      key: 'n',
      code: 'KeyN',
      ctrlKey: true,
      altKey: true,
    })

    expect(search.defaultPrevented).toBe(false)
    expect(create.defaultPrevented).toBe(false)
    expect(useSearchStore().modalOpen).toBe(false)
    expect(useQuickAddStore().menuOpen).toBe(false)
  })
})

describe('Ctrl+Enter (RAC-05)', () => {
  function formHost(onSubmit: () => void, disabled = ref(false)) {
    const state = reactive({ label: '' })
    return () =>
      h('div', [
        h('button', { 'data-testid': 'outside' }),
        h(
          AppForm,
          { state, onSubmit },
          {
            default: () => [
              h('input', { 'data-testid': 'inside' }),
              h('button', {
                type: 'submit',
                disabled: disabled.value,
                'data-testid': 'submit',
              }),
            ],
          },
        ),
      ])
  }

  it('submits the form holding the focus through its submit button', async () => {
    const onSubmit = vi.fn()
    await mountHost(() => undefined, formHost(onSubmit))

    findInBody('[data-testid="outside"]')?.focus()
    press({ key: 'Enter', code: 'Enter', ctrlKey: true })
    findInBody('[data-testid="inside"]')?.focus()
    const event = press({ key: 'Enter', code: 'Enter', ctrlKey: true })

    expect(event.defaultPrevented).toBe(true)
    await vi.waitFor(() => {
      expect(onSubmit).toHaveBeenCalledOnce()
    })
  })

  it('leaves the key when the submit button is disabled', async () => {
    const onSubmit = vi.fn()
    await mountHost(() => undefined, formHost(onSubmit, ref(true)))

    findInBody('[data-testid="inside"]')?.focus()
    const event = press({ key: 'Enter', code: 'Enter', ctrlKey: true })

    expect(event.defaultPrevented).toBe(false)
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('confirms an open confirmation modal holding the focus', async () => {
    const onConfirm = vi.fn()
    const wrapper = await mountInApp(ConfirmModal, {
      props: {
        open: true,
        title: 'Supprimer ce compte ?',
        description: 'Action définitive.',
        confirmLabel: 'Supprimer',
        onConfirm,
      },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="confirm-modal-confirm"]')).not.toBeNull()
    })

    findInBody('[data-testid="confirm-modal-confirm"]')?.focus()
    press({ key: 'Enter', code: 'Enter', ctrlKey: true })

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(
      findInBody('[data-testid="confirm-modal-confirm"]')?.getAttribute(
        'aria-keyshortcuts',
      ),
    ).toBe('Control+Enter')
  })
})

describe('view shortcuts (RAC-03, RAC-04)', () => {
  it('creates an account in the Accounts view rather than opening the Add menu', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({
        totalCents: 0,
        groups: [],
        archived: [],
      }),
      'GET /payment-methods': () => [],
    })
    const page = await mountInApp(AccountsPage, { route: '/accounts' })
    mounted.push(page)
    await mountHost(() => useGlobalShortcuts())
    await vi.waitFor(() => {
      expect(page.text()).toContain('Aucun compte')
    })
    expect(
      page.get('[data-testid="accounts-add"]').attributes('aria-keyshortcuts'),
    ).toBe('Control+Alt+N')

    setViewportWidth(1280)
    press({ key: 'n', code: 'KeyN', ctrlKey: true, altKey: true })

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="account-form"]')).not.toBeNull()
    })
    expect(useQuickAddStore().menuOpen).toBe(false)
  })
})
