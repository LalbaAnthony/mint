import { afterEach, describe, expect, it } from 'vitest'
import { h } from 'vue'
import { UDashboardGroup } from '#components'
import { signIn } from '../session'
import AppSidebar from '~/components/AppSidebar.vue'
import { mountInApp } from '../app'

afterEach(() => {
  signIn('user')
})

describe('AppSidebar (CHG-55)', () => {
  it('starts with the 28 px picto, the wordmark and the home link name', async () => {
    const wrapper = await mountInApp(AppSidebar, { route: '/' })

    const homeLink = wrapper.get('a[aria-label="Mint, accueil"]')
    expect(homeLink.get('img').attributes()).toMatchObject({
      src: '/logo.svg',
      alt: '',
    })
    expect(homeLink.get('img').classes()).toContain('size-7')
    expect(homeLink.text()).toBe('Mint')
  })

  it('shows a full-width solid primary Add button', async () => {
    const wrapper = await mountInApp(AppSidebar, { route: '/' })

    const add = wrapper.get('[data-testid="sidebar-quick-add"]')
    expect(add.text()).toBe('Ajouter')
    expect(add.classes()).toEqual(
      expect.arrayContaining(['w-full', 'bg-primary']),
    )
  })

  it('puts the search trigger right above the Add button (RCH-01)', async () => {
    const wrapper = await mountInApp(AppSidebar, { route: '/' })

    const search = wrapper.get('[data-testid="sidebar-search"]').element
    const add = wrapper.get('[data-testid="sidebar-quick-add"]').element
    expect(search.compareDocumentPosition(add)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    )
    expect(search.nextElementSibling?.contains(add)).toBe(true)
  })

  it('groups the navigation in three separated lists', async () => {
    const wrapper = await mountInApp(AppSidebar, { route: '/' })

    const navigation = wrapper.get('[data-testid="sidebar-navigation"]')
    const labels = navigation
      .findAll('[data-slot="linkLabel"]')
      .map((label) => label.text())
    expect(labels).toEqual([
      'Accueil',
      'Comptes',
      'Calendrier',
      'Opérations',
      'Échéances',
      'Abonnements',
      'Enveloppes',
      'Import',
      'Règles',
    ])
    expect(navigation.findAll('[data-slot="separator"]')).toHaveLength(2)
  })

  it('puts Profile and Administration in a secondary navigation in the footer', async () => {
    signIn('admin')
    const wrapper = await mountInApp(AppSidebar, { route: '/' })

    const secondary = wrapper.get(
      '[data-testid="sidebar-secondary-navigation"]',
    )
    expect(secondary.attributes('aria-label')).toBe('Navigation secondaire')
    const links = secondary.findAll('[data-slot="link"]')
    expect(links.map((link) => link.text())).toEqual([
      'Profil',
      'Administration',
    ])
    expect(links.map((link) => link.attributes('href'))).toEqual([
      '/profile',
      '/admin',
    ])
    expect(wrapper.text()).not.toContain('Déconnexion')
    expect(wrapper.text()).not.toContain('Raccourcis clavier')
  })

  it('renders Profile and Administration like the other entries', async () => {
    signIn('admin')
    const selector = '[data-testid="sidebar-secondary-navigation"] a'

    const elsewhere = await mountInApp(AppSidebar, { route: '/accounts' })
    const [profile, administration] = elsewhere.findAll(selector)
    expect(profile?.classes()).toContain('text-muted')
    expect(administration?.classes()).toContain('text-muted')
    elsewhere.unmount()

    const onProfile = await mountInApp(AppSidebar, { route: '/profile' })
    expect(onProfile.findAll(selector)[0]?.classes()).toContain('text-primary')
    expect(onProfile.findAll(selector)[1]?.classes()).toContain('text-muted')
    onProfile.unmount()

    const onAdministration = await mountInApp(AppSidebar, { route: '/admin' })
    expect(onAdministration.findAll(selector)[0]?.classes()).toContain(
      'text-muted',
    )
    expect(onAdministration.findAll(selector)[1]?.classes()).toContain(
      'text-primary',
    )
  })

  it('aligns the footer icons on the navigation links', async () => {
    signIn('admin')
    const wrapper = await mountInApp(UDashboardGroup, {
      route: '/',
      props: { unit: 'px' },
      slots: { default: () => h(AppSidebar) },
    })

    const [profile, administration] = wrapper.findAll(
      '[data-testid="sidebar-secondary-navigation"] a',
    )
    const collapse = wrapper.get('[data-testid="sidebar-collapse"]')
    for (const control of [profile, administration, collapse]) {
      expect(control?.classes()).toContain('px-2.5')
    }

    await collapse.trigger('click')

    expect(wrapper.get('[data-testid="sidebar-collapse"]').classes()).toEqual(
      expect.arrayContaining(['p-1.5']),
    )
    expect(
      wrapper.get('[data-testid="sidebar-collapse"]').classes(),
    ).not.toContain('px-2.5')
  })

  it('shows Administration to an administrator only', async () => {
    const wrapper = await mountInApp(AppSidebar, { route: '/' })
    const secondary = () =>
      wrapper.get('[data-testid="sidebar-secondary-navigation"]').text()

    expect(secondary()).toBe('Profil')

    signIn('admin')
    await wrapper.vm.$nextTick()

    expect(secondary()).toContain('Administration')
  })
})
