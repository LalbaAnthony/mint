import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPage from '~/pages/admin/index.vue'
import ProfilePage from '~/pages/profile/index.vue'
import { installFakeApi } from '../fake-api'
import { signIn, testProfile } from '../session'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const pendingInvitation = {
  id: '00000000-0000-4000-8000-0000000000a1',
  email: 'pending@example.org',
  status: 'pending',
  createdAt: '2026-12-01T08:00:00.000Z',
  expiresAt: '2026-12-08T08:00:00.000Z',
  acceptedAt: null,
  revokedAt: null,
}

const member = {
  id: '00000000-0000-4000-8000-0000000000b1',
  email: 'member@example.org',
  role: 'user',
  locale: 'en',
  status: 'active',
  createdAt: '2026-11-01T08:00:00.000Z',
  lastLoginAt: null,
}

const administrator = {
  ...member,
  id: testProfile.id,
  email: testProfile.email,
  role: 'admin',
  locale: 'fr',
  lastLoginAt: '2026-11-11T09:00:00.000Z',
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  fetchMock.mockReset()
})

describe('administration console (ADM-01 to ADM-06, US-02)', () => {
  it('lists invitations and users with their status, never financial data', async () => {
    signIn('admin')
    installFakeApi(fetchMock, {
      'GET /admin/invitations': () => [pendingInvitation],
      'GET /admin/users': () => [administrator, member],
    })

    const wrapper = await mountSuspended(AdminPage, { route: '/admin' })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="invitation-list"]').text()).toContain(
        'pending@example.org',
      )
    })
    const invitations = wrapper.get('[data-testid="invitation-list"]').text()
    expect(invitations).toContain('En attente')
    expect(invitations).toContain('Renvoyer')
    const users = wrapper.get('[data-testid="user-list"]').text()
    expect(users).toContain('member@example.org')
    expect(users).toContain('Utilisateur')
    expect(users).toContain('English')
    expect(users).toContain('jamais connecté')
    expect(users).toContain('Désactiver')
    expect(users.match(/Désactiver/g)).toHaveLength(1)
  })

  it('resends an invitation', async () => {
    signIn('admin')
    const api = installFakeApi(fetchMock, {
      'GET /admin/invitations': () => [pendingInvitation],
      'GET /admin/users': () => [administrator],
      [`POST /admin/invitations/${pendingInvitation.id}/resend`]: () =>
        pendingInvitation,
    })
    const wrapper = await mountSuspended(AdminPage, { route: '/admin' })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="invitation-list"]').exists()).toBe(
        true,
      )
    })

    const resend = wrapper
      .findAll('[data-testid="invitation-list"] button')
      .find((button) => button.text() === 'Renvoyer')
    await resend?.trigger('click')

    await vi.waitFor(() => {
      expect(api.requests.map((request) => request.path)).toContain(
        `/admin/invitations/${pendingInvitation.id}/resend`,
      )
    })
  })

  it('shows the empty state without invitation (CHG-66)', async () => {
    signIn('admin')
    installFakeApi(fetchMock, {
      'GET /admin/invitations': () => [],
      'GET /admin/users': () => [administrator],
    })

    const wrapper = await mountSuspended(AdminPage, { route: '/admin' })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucune invitation')
    })
  })
})

describe('profile (AUTH-05, AUTH-07)', () => {
  const sessions = [
    {
      id: '00000000-0000-4000-8000-0000000000c1',
      createdAt: '2026-11-10T08:00:00.000Z',
      lastSeenAt: '2026-11-11T09:00:00.000Z',
      userAgent: 'Firefox',
      ip: '203.0.113.7',
      current: true,
    },
    {
      id: '00000000-0000-4000-8000-0000000000c2',
      createdAt: '2026-11-09T08:00:00.000Z',
      lastSeenAt: '2026-11-10T09:00:00.000Z',
      userAgent: null,
      ip: null,
      current: false,
    },
  ]

  it('lists the sessions and flags the current one', async () => {
    signIn('user')
    installFakeApi(fetchMock, {
      'GET /profile/sessions': () => sessions,
      'GET /categories': () => [],
      'GET /tags': () => [],
    })

    const wrapper = await mountSuspended(ProfilePage, { route: '/profile' })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="session-list"]').text()).toContain(
        'Firefox',
      )
    })
    const list = wrapper.get('[data-testid="session-list"]').text()
    expect(list).toContain('Cette session')
    expect(list).toContain('Appareil inconnu')
    expect(wrapper.get('[data-testid="profile-email"]').text()).toBe(
      testProfile.email,
    )
  })

  it('saves the preferences and applies the returned profile, theme included (NF-UX-02)', async () => {
    signIn('user')
    const api = installFakeApi(fetchMock, {
      'GET /profile/sessions': () => sessions,
      'GET /categories': () => [],
      'GET /tags': () => [],
      'PATCH /profile': () => ({
        ...testProfile,
        theme: 'dark',
        forecastHorizonMonths: 6,
      }),
    })
    const wrapper = await mountSuspended(ProfilePage, { route: '/profile' })

    await wrapper.get('[data-testid="preferences-form"]').trigger('submit')

    await vi.waitFor(() => {
      expect(useSessionStore().user?.forecastHorizonMonths).toBe(6)
    })
    expect(
      api.requests.find((request) => request.method === 'PATCH')?.body,
    ).toEqual({
      locale: 'fr',
      theme: 'system',
      forecastHorizonMonths: 3,
      targets: { needs: 50, wants: 30, save: 20 },
    })
    await vi.waitFor(() => {
      expect(useColorMode().preference).toBe('dark')
    })
  })
})
