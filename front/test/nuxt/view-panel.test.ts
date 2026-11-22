import { describe, expect, it } from 'vitest'
import AppBrand from '~/components/AppBrand.vue'
import ViewPanel from '~/components/ViewPanel.vue'
import { mountInApp } from '../app'

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
