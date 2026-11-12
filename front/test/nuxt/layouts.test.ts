import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import App from '~/app.vue'
import AuthLayout from '~/layouts/auth.vue'
import DefaultLayout from '~/layouts/default.vue'
import AccountsPage from '~/pages/accounts/index.vue'
import AdminPage from '~/pages/admin/index.vue'
import CalendarPage from '~/pages/calendar/index.vue'
import EnvelopesPage from '~/pages/envelopes/index.vue'
import ImportPage from '~/pages/import/index.vue'
import HomePage from '~/pages/index.vue'
import OperationsPage from '~/pages/operations/index.vue'
import ProfilePage from '~/pages/profile/index.vue'
import RulesPage from '~/pages/rules/index.vue'
import SchedulesPage from '~/pages/schedules/index.vue'
import SubscriptionsPage from '~/pages/subscriptions/index.vue'

describe('default layout (CHG-50)', () => {
  it('combines the sidebar, the content, the bottom bar and the FAB', async () => {
    const wrapper = await mountSuspended(DefaultLayout, {
      route: '/accounts',
      slots: { default: () => h('p', 'Contenu') },
    })

    expect(wrapper.get('main').text()).toBe('Contenu')
    expect(wrapper.find('[data-testid="sidebar-navigation"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="bottom-bar"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="fab"]').exists()).toBe(true)
  })
})

describe('auth layout (CHG-59)', () => {
  it('centers a max-w-sm card under the brand', async () => {
    const wrapper = await mountSuspended(AuthLayout, {
      slots: { default: () => h('p', 'Formulaire') },
    })

    const main = wrapper.get('main')
    expect(main.get('img').classes()).toContain('size-12')
    expect(main.get('.max-w-sm').text()).toBe('Formulaire')
  })
})

describe('placeholder views', () => {
  it.each([
    [HomePage, 'Accueil'],
    [AccountsPage, 'Comptes'],
    [CalendarPage, 'Calendrier'],
    [OperationsPage, 'Opérations'],
    [SchedulesPage, 'Échéances'],
    [SubscriptionsPage, 'Abonnements'],
    [EnvelopesPage, 'Enveloppes'],
    [ImportPage, 'Import'],
    [RulesPage, 'Règles'],
    [ProfilePage, 'Profil et préférences'],
    [AdminPage, 'Administration'],
  ])('renders the view title %#', async (page, title) => {
    const wrapper = await mountSuspended(page)

    expect(wrapper.get('h1').text()).toBe(title)
  })
})

describe('app', () => {
  it('sets the document title and language', async () => {
    await mountSuspended(App, { route: '/accounts' })

    await vi.waitFor(() => {
      expect(document.title).toBe('Comptes - Mint')
    })
    expect(document.documentElement.lang).toBe('fr-FR')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('uses the login title on the login screen', async () => {
    await mountSuspended(App, { route: '/login' })

    await vi.waitFor(() => {
      expect(document.title).toBe('Connexion - Mint')
    })
  })
})
