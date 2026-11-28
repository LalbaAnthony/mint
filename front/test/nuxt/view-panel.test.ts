import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import AppBrand from '~/components/AppBrand.vue'
import ViewPanel from '~/components/ViewPanel.vue'
import { mountInApp } from '../app'

const { routeState } = vi.hoisted(() => ({
  routeState: { path: '/', fullPath: '/', meta: { hideFab: false } },
}))

mockNuxtImport('useRoute', () => () => reactive(routeState))

afterEach(() => {
  routeState.path = '/'
  routeState.fullPath = '/'
  routeState.meta.hideFab = false
})

async function bodyClasses(): Promise<string[]> {
  const wrapper = await mountInApp(ViewPanel, {
    props: { title: 'Comptes' },
  })
  return wrapper.get('[data-slot="body"]').classes()
}

describe('ViewPanel bottom space (CHG-54)', () => {
  it('ends the content 16 px above the search button', async () => {
    expect(await bodyClasses()).toContain(
      'max-lg:pb-[calc(64px+16px+56px+16px+56px+16px+env(safe-area-inset-bottom))]',
    )
  })

  it('ends the content 16 px above the add button on the results page', async () => {
    routeState.path = '/search'
    routeState.fullPath = '/search?q=loyer'

    expect(await bodyClasses()).toContain(
      'max-lg:pb-[calc(64px+16px+56px+16px+env(safe-area-inset-bottom))]',
    )
  })

  it('ends the content 16 px above the bottom bar on views flagged with hideFab', async () => {
    routeState.meta.hideFab = true

    expect(await bodyClasses()).toContain(
      'max-lg:pb-[calc(64px+16px+env(safe-area-inset-bottom))]',
    )
  })
})

describe('ViewPanel (CHG-51, CHG-56)', () => {
  it('renders the view title as the page heading', async () => {
    const wrapper = await mountInApp(ViewPanel, {
      props: { title: 'Comptes' },
    })

    expect(wrapper.get('h1').text()).toBe('Comptes')
    expect(wrapper.get('h1').classes()).toContain('text-lg')
  })

  it('shows a 24 px home picto on mobile only', async () => {
    const wrapper = await mountInApp(ViewPanel, {
      props: { title: 'Comptes' },
    })

    const homeLink = wrapper.get('a[aria-label="Mint, accueil"]')
    expect(homeLink.classes()).toContain('lg:hidden')
    expect(homeLink.get('img').attributes('alt')).toBe('')
    expect(homeLink.get('img').classes()).toContain('size-6')
  })

  it('uses a 56 px header on mobile on a default surface', async () => {
    const wrapper = await mountInApp(ViewPanel, {
      props: { title: 'Comptes' },
    })

    const navbar = wrapper.get('h1').element.closest('[data-slot="root"]')

    expect(Array.from(navbar?.classList ?? [])).toEqual(
      expect.arrayContaining([
        'h-14',
        'bg-default',
        'lg:h-(--ui-header-height)',
      ]),
    )
  })

  it('renders the actions slot on the right', async () => {
    const wrapper = await mountInApp(ViewPanel, {
      props: { title: 'Comptes' },
      slots: { actions: () => 'Action' },
    })

    expect(wrapper.get('[data-slot="right"]').text()).toBe('Action')
  })

  it('puts the shortcuts help between the masked mode and the bell (CHG-46)', async () => {
    const wrapper = await mountInApp(ViewPanel, {
      props: { title: 'Comptes' },
    })

    const controls = wrapper
      .get('[data-slot="right"]')
      .findAll('button')
      .map((button) => button.attributes('data-testid'))
    expect(controls).toEqual([
      'amount-mask-toggle',
      'shortcut-help-button',
      'notification-bell',
    ])
  })
})

describe('AppBrand (CHG-04, CHG-05, CHG-59)', () => {
  it('shows a 48 px picto and a text-3xl wordmark on the login screen', async () => {
    const wrapper = await mountInApp(AppBrand, {
      props: { variant: 'login' },
    })

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.get('img').classes()).toContain('size-12')
    expect(wrapper.get('span').text()).toBe('Mint')
    expect(wrapper.get('span').classes()).toEqual(
      expect.arrayContaining([
        'text-3xl',
        'font-bold',
        'tracking-tight',
        'text-highlighted',
      ]),
    )
  })

  it('keeps only the picto when the sidebar is collapsed', async () => {
    const wrapper = await mountInApp(AppBrand, {
      props: { variant: 'sidebar', collapsed: true },
    })

    expect(wrapper.get('a').attributes('aria-label')).toBe('Mint, accueil')
    expect(wrapper.find('span').exists()).toBe(false)
  })
})
