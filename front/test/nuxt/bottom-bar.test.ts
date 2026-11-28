import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { signIn } from '../session'
import { nextTick } from 'vue'
import AppBottomBar from '~/components/AppBottomBar.vue'

const entryIds = ['home', 'accounts', 'calendar', 'operations', 'more']

function findMoreNavigation(): HTMLElement | null {
  return document.body.querySelector('[data-testid="more-navigation"]')
}

afterEach(() => {
  signIn('user')
  document.body.innerHTML = ''
})

describe('AppBottomBar (CHG-52)', () => {
  it('shows five labelled entries with a 24 px icon', async () => {
    const wrapper = await mountSuspended(AppBottomBar, { route: '/' })

    const labels = entryIds.map((id) =>
      wrapper.get(`[data-testid="bottom-bar-${id}"]`).text(),
    )
    expect(labels).toEqual([
      'Accueil',
      'Comptes',
      'Calendrier',
      'Opérations',
      'Plus',
    ])
    expect(wrapper.findAll('.size-6')).toHaveLength(5)
  })

  it('is hidden from 1024 px', async () => {
    const wrapper = await mountSuspended(AppBottomBar, { route: '/' })

    expect(wrapper.get('[data-testid="bottom-bar"]').classes()).toContain(
      'lg:hidden',
    )
  })

  it('highlights the active entry only', async () => {
    const wrapper = await mountSuspended(AppBottomBar, { route: '/accounts' })

    const accounts = wrapper.get('[data-testid="bottom-bar-accounts"]')
    expect(accounts.classes()).toContain('text-primary')
    expect(accounts.attributes('aria-current')).toBe('page')
    expect(accounts.find('.bg-primary\\/10').exists()).toBe(true)

    const home = wrapper.get('[data-testid="bottom-bar-home"]')
    expect(home.classes()).toContain('text-muted')
    expect(home.attributes('aria-current')).toBeUndefined()
  })

  it('highlights More on a view reached through the drawer', async () => {
    const wrapper = await mountSuspended(AppBottomBar, { route: '/schedules' })

    expect(wrapper.get('[data-testid="bottom-bar-more"]').classes()).toContain(
      'text-primary',
    )
  })

  it('opens the More drawer with its entries (CHG-53)', async () => {
    const wrapper = await mountSuspended(AppBottomBar, { route: '/' })
    const more = wrapper.get('[data-testid="bottom-bar-more"]')

    expect(more.attributes('aria-expanded')).toBe('false')
    await more.trigger('click')
    await nextTick()

    expect(more.attributes('aria-expanded')).toBe('true')
    await vi.waitFor(() => {
      expect(findMoreNavigation()).not.toBeNull()
    })
    const labels = Array.from(
      findMoreNavigation()?.querySelectorAll('[data-slot="linkLabel"]') ?? [],
      (element) => element.textContent?.trim(),
    )
    expect(labels).toEqual([
      'Échéances',
      'Abonnements',
      'Enveloppes',
      'Import',
      'Règles',
      'Profil et préférences',
    ])
  })
})
