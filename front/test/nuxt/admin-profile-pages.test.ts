import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AdminPage from '~/pages/admin/index.vue'
import ProfilePage from '~/pages/profile/index.vue'
import { installFakeApi } from '../fake-api'
import {
  account,
  focusedTestId,
  ids,
  livret,
  overview,
  referentialHandlers,
  selectByTestId,
} from '../planning-fixtures'
import { signIn, testProfile } from '../session'

const archivedAccountId = '00000000-0000-4000-8000-0000000000a9'

function patchedDefaultAccount(body: unknown): string | null | undefined {
  if (typeof body !== 'object' || body === null) {
    return undefined
  }
  const value: unknown = Reflect.get(body, 'defaultAccountId')
  return typeof value === 'string' || value === null ? value : undefined
}

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
      ...referentialHandlers(),
      'GET /profile/sessions': () => sessions,
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
      ...referentialHandlers(),
      'GET /profile/sessions': () => sessions,
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
      defaultAccountId: null,
    })
    await vi.waitFor(() => {
      expect(useColorMode().preference).toBe('dark')
    })
  })

  it('offers None and the active accounts as default account, without focusing None (ADR 0033, CHG-69)', async () => {
    signIn('user')
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /accounts/overview': () => ({
        ...overview([account(), livret]),
        archived: [
          account({
            id: archivedAccountId,
            name: 'Ancien compte',
            archivedAt: '2026-11-01T08:00:00.000Z',
          }),
        ],
      }),
      'GET /profile/sessions': () => sessions,
    })
    const wrapper = await mountSuspended(ProfilePage, { route: '/profile' })
    const select = () => selectByTestId(wrapper, 'preferences-default-account')

    await vi.waitFor(() => {
      expect(select()?.items()).toEqual([
        { label: 'Aucun', value: 'none' },
        { label: 'Compte courant', value: ids.current },
        { label: 'Livret A', value: ids.livret },
      ])
    })
    expect(select()?.value()).toBe('none')
    expect(focusedTestId()).toBeNull()
  })

  it('shows None when the default account of the session is no longer active (ADR 0033)', async () => {
    signIn('user', { defaultAccountId: archivedAccountId })
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /accounts/overview': () => ({
        ...overview([account(), livret]),
        archived: [
          account({
            id: archivedAccountId,
            name: 'Ancien compte',
            archivedAt: '2026-11-01T08:00:00.000Z',
          }),
        ],
      }),
      'GET /profile/sessions': () => sessions,
    })
    const wrapper = await mountSuspended(ProfilePage, { route: '/profile' })

    await vi.waitFor(() => {
      expect(
        selectByTestId(wrapper, 'preferences-default-account')?.value(),
      ).toBe('none')
    })
  })

  it('saves the chosen default account, then None as null (ADR 0033)', async () => {
    signIn('user', { defaultAccountId: ids.current })
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /profile/sessions': () => sessions,
      'PATCH /profile': (request) => ({
        ...testProfile,
        defaultAccountId: patchedDefaultAccount(request.body),
      }),
    })
    const wrapper = await mountSuspended(ProfilePage, { route: '/profile' })
    const select = () => selectByTestId(wrapper, 'preferences-default-account')
    await vi.waitFor(() => {
      expect(select()?.value()).toBe(ids.current)
    })

    select()?.choose(ids.livret)
    await wrapper.get('[data-testid="preferences-form"]').trigger('submit')
    await vi.waitFor(() => {
      expect(useSessionStore().user?.defaultAccountId).toBe(ids.livret)
    })

    select()?.choose('none')
    await wrapper.get('[data-testid="preferences-form"]').trigger('submit')
    await vi.waitFor(() => {
      expect(useSessionStore().user?.defaultAccountId).toBeNull()
    })
    expect(
      api.requests
        .filter((request) => request.method === 'PATCH')
        .map((request) => patchedDefaultAccount(request.body)),
    ).toEqual([ids.livret, null])
  })
})
