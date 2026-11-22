import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, reactive } from 'vue'
import { UApp } from '#components'
import AppSearchFab from '~/components/AppSearchFab.vue'
import AppSearchTrigger from '~/components/AppSearchTrigger.vue'

const { routeState } = vi.hoisted(() => ({
  routeState: { path: '/', fullPath: '/', meta: { hideFab: false } },
}))

mockNuxtImport('useRoute', () => () => reactive(routeState))

function fab() {
  return mountSuspended(
    defineComponent({
      setup: () => () => h(UApp, null, { default: () => h(AppSearchFab) }),
    }),
  )
}

function trigger(collapsed: boolean) {
  return mountSuspended(
    defineComponent({
      setup: () => () =>
        h(UApp, null, { default: () => h(AppSearchTrigger, { collapsed }) }),
    }),
  )
}

function setOnline(isOnline: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => isOnline,
  })
  window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'))
}

afterEach(() => {
  routeState.path = '/'
  routeState.fullPath = '/'
  routeState.meta.hideFab = false
  useSearchStore().closeModal()
  setOnline(true)
})

describe('AppSearchFab (CHG-54, RCH-01)', () => {
  it('renders a 56 px round soft neutral button 16 px above the add button', async () => {
    const wrapper = await fab()

    const button = wrapper.get('[data-testid="search-fab"]')
    expect(button.attributes('aria-label')).toBe('Rechercher')
    expect(button.attributes('aria-haspopup')).toBe('dialog')
    expect(button.classes()).toEqual(
      expect.arrayContaining([
        'size-14',
        'rounded-full',
        'bg-elevated',
        'shadow-lg',
        'right-4',
        'bottom-[calc(64px+16px+56px+16px+env(safe-area-inset-bottom))]',
        'lg:hidden',
      ]),
    )
    expect(button.classes()).not.toContain('bg-primary')
  })

  it('opens the search modal', async () => {
    const wrapper = await fab()

    await wrapper.get('[data-testid="search-fab"]').trigger('click')

    expect(useSearchStore().modalOpen).toBe(true)
  })

  it('is hidden on views flagged with hideFab and on the results page', async () => {
    routeState.meta.hideFab = true
    const onForm = await fab()
    expect(onForm.find('[data-testid="search-fab"]').exists()).toBe(false)

    routeState.meta.hideFab = false
    routeState.path = '/search'
    routeState.fullPath = '/search?q=loyer'
    const onResults = await fab()
    expect(onResults.find('[data-testid="search-fab"]').exists()).toBe(false)
  })

  it('is disabled offline', async () => {
    const wrapper = await fab()

    setOnline(false)
    await wrapper.vm.$nextTick()

    expect(
      wrapper.get('[data-testid="search-fab"]').attributes(),
    ).toHaveProperty('disabled')
  })
})

describe('AppSearchTrigger (CHG-55, RCH-01)', () => {
  it('looks like a field joined to a grey search button, with a single tab stop', async () => {
    const wrapper = await trigger(false)

    const field = wrapper.get('[data-testid="sidebar-search-field"]')
    const button = wrapper.get('[data-testid="sidebar-search-button"]')
    expect(field.text()).toBe('Rechercher…')
    expect(field.attributes('aria-label')).toBe('Rechercher')
    expect(field.classes()).toEqual(
      expect.arrayContaining(['ring-accented', 'text-muted']),
    )
    expect(button.classes()).toContain('bg-elevated')
    expect(button.attributes()).toMatchObject({
      tabindex: '-1',
      'aria-hidden': 'true',
    })
  })

  it('opens the search modal from the field and from the button', async () => {
    const wrapper = await trigger(false)

    await wrapper.get('[data-testid="sidebar-search-field"]').trigger('click')
    expect(useSearchStore().modalOpen).toBe(true)

    useSearchStore().closeModal()
    await wrapper.get('[data-testid="sidebar-search-button"]').trigger('click')
    expect(useSearchStore().modalOpen).toBe(true)
  })

  it('shrinks to the search icon in the collapsed sidebar', async () => {
    const wrapper = await trigger(true)

    const button = wrapper.get('[data-testid="sidebar-search"]')
    expect(button.element.tagName).toBe('BUTTON')
    expect(button.attributes('aria-label')).toBe('Rechercher')
    expect(button.text()).toBe('')
    expect(wrapper.find('[data-testid="sidebar-search-field"]').exists()).toBe(
      false,
    )
  })

  it('is disabled offline', async () => {
    const wrapper = await trigger(false)

    setOnline(false)
    await wrapper.vm.$nextTick()

    expect(
      wrapper.get('[data-testid="sidebar-search-field"]').attributes(),
    ).toHaveProperty('disabled')
    expect(
      wrapper.get('[data-testid="sidebar-search-button"]').attributes(),
    ).toHaveProperty('disabled')
  })
})
