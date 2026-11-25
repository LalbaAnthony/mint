import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import AppAddFab from '~/components/AppAddFab.vue'
import { mountInApp } from '../app'

const { routeState } = vi.hoisted(() => ({
  routeState: { path: '/', fullPath: '/', meta: { hideFab: false } },
}))

mockNuxtImport('useRoute', () => () => reactive(routeState))

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
  setOnline(true)
})

describe('AppAddFab (CHG-54)', () => {
  it('renders a 56 px round solid primary button above the bottom bar', async () => {
    const wrapper = await mountInApp(AppAddFab)

    const fab = wrapper.get('[data-testid="add-fab"]')
    expect(fab.attributes('aria-label')).toBe('Ajouter')
    expect(fab.classes()).toEqual(
      expect.arrayContaining([
        'size-14',
        'rounded-full',
        'bg-primary',
        'shadow-lg',
        'right-4',
        'bottom-[calc(64px+16px+env(safe-area-inset-bottom))]',
        'lg:hidden',
      ]),
    )
    expect(fab.attributes('disabled')).toBeUndefined()
  })

  it('is hidden on views flagged with hideFab', async () => {
    routeState.meta.hideFab = true

    const wrapper = await mountInApp(AppAddFab)

    expect(wrapper.find('[data-testid="add-fab"]').exists()).toBe(false)
  })

  it('stays on the search results page', async () => {
    routeState.path = '/search'
    routeState.fullPath = '/search?q=loyer'

    const wrapper = await mountInApp(AppAddFab)

    expect(wrapper.find('[data-testid="add-fab"]').exists()).toBe(true)
  })

  it('is disabled offline', async () => {
    const wrapper = await mountInApp(AppAddFab)

    setOnline(false)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="add-fab"]').attributes()).toHaveProperty(
      'disabled',
    )
  })
})
