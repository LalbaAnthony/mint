import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import AppSidebar from '~/components/AppSidebar.vue'

afterEach(() => {
  useSessionStore().role = null
})

describe('AppSidebar (CHG-55)', () => {
  it('starts with the 28 px picto, the wordmark and the home link name', async () => {
    const wrapper = await mountSuspended(AppSidebar, { route: '/' })

    const homeLink = wrapper.get('a[aria-label="Mint, accueil"]')
    expect(homeLink.get('img').attributes()).toMatchObject({
      src: '/logo.svg',
      alt: '',
    })
    expect(homeLink.get('img').classes()).toContain('size-7')
    expect(homeLink.text()).toBe('Mint')
  })

  it('shows a full-width solid primary Add button', async () => {
    const wrapper = await mountSuspended(AppSidebar, { route: '/' })

    const add = wrapper.get('[data-testid="sidebar-quick-add"]')
    expect(add.text()).toBe('Ajouter')
    expect(add.classes()).toEqual(
      expect.arrayContaining(['w-full', 'bg-primary']),
    )
  })

  it('groups the navigation in three separated lists', async () => {
    const wrapper = await mountSuspended(AppSidebar, { route: '/' })

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

  it('puts Profile in the footer', async () => {
    const wrapper = await mountSuspended(AppSidebar, { route: '/' })

    expect(wrapper.get('[data-testid="sidebar-profile"]').text()).toBe('Profil')
  })

  it('shows Administration to an administrator only', async () => {
    const wrapper = await mountSuspended(AppSidebar, { route: '/' })

    expect(
      wrapper.find('[data-testid="sidebar-administration"]').exists(),
    ).toBe(false)

    useSessionStore().role = 'admin'
    await wrapper.vm.$nextTick()

    expect(
      wrapper.get('[data-testid="sidebar-administration"]').text(),
    ).toContain('Administration')
  })
})
