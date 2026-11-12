import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import AppFab from '~/components/AppFab.vue'

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
  routeState.meta.hideFab = false
  setOnline(true)
})

describe('AppFab (CHG-54)', () => {
  it('renders a 56 px round solid primary button above the bottom bar', async () => {
    const wrapper = await mountSuspended(AppFab)

    const fab = wrapper.get('[data-testid="fab"]')
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

    const wrapper = await mountSuspended(AppFab)

    expect(wrapper.find('[data-testid="fab"]').exists()).toBe(false)
  })

  it('is disabled offline', async () => {
    const wrapper = await mountSuspended(AppFab)

    setOnline(false)
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="fab"]').attributes()).toHaveProperty(
      'disabled',
    )
  })
})
