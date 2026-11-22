import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import InvitationPage from '~/pages/invitation.vue'
import LoginPage from '~/pages/login.vue'
import { apiFailure, installFakeApi } from '../fake-api'
import { signOut, testProfile } from '../session'
import { mountInApp } from '../app'

const token = 'a'.repeat(43)

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

beforeEach(() => {
  resetCsrfToken()
  signOut()
})

afterEach(async () => {
  fetchMock.mockReset()
  await useNuxtApp().$i18n.setLocale('fr')
})

async function fill(
  wrapper: VueWrapper,
  testId: string,
  value: string,
): Promise<void> {
  const target = wrapper.get(`[data-testid="${testId}"]`)
  const input =
    target.element.tagName === 'INPUT' ? target : target.get('input')
  await input.setValue(value)
}

describe('login page (AUTH-02, CHG-59)', () => {
  it('logs in and lands on the requested view', async () => {
    const api = installFakeApi(fetchMock, {
      'POST /auth/login': () => testProfile,
    })
    const wrapper = await mountInApp(LoginPage, {
      route: '/login?redirect=/accounts',
    })

    await fill(wrapper, 'login-email', 'me@example.org')
    await fill(wrapper, 'login-password', 'correct horse battery')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(useSessionStore().status).toBe('authenticated')
    })
    expect(
      api.requests.find((request) => request.path === '/auth/login')?.body,
    ).toEqual({
      email: 'me@example.org',
      password: 'correct horse battery',
    })
    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.path).toBe('/accounts')
    })
  })

  it('explains a locked account with the remaining minutes', async () => {
    installFakeApi(fetchMock, {
      'POST /auth/login': () =>
        apiFailure(429, { error: 'account_locked', retryAfterSeconds: 840 }),
    })
    const wrapper = await mountInApp(LoginPage, { route: '/login' })

    await fill(wrapper, 'login-email', 'me@example.org')
    await fill(wrapper, 'login-password', 'wrong password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="login-error"]').text()).toContain(
        'réessayez dans 14 min',
      )
    })
  })

  it('links to the password reset', async () => {
    const wrapper = await mountInApp(LoginPage, { route: '/login' })

    expect(
      wrapper.get('[data-testid="forgot-password-link"]').attributes('href'),
    ).toBe('/forgot-password')
  })
})

describe('invitation page (US-01)', () => {
  it('tells the invitee that the invitation expired', async () => {
    installFakeApi(fetchMock, {
      'POST /auth/invitation/check': () =>
        apiFailure(410, { error: 'invitation_expired' }),
    })

    const wrapper = await mountInApp(InvitationPage, {
      route: `/invitation#token=${token}`,
    })

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="invitation-error"]').text()).toContain(
        'Cette invitation a expiré',
      )
    })
    expect(wrapper.find('[data-testid="invitation-form"]').exists()).toBe(false)
  })

  it('creates the account with the chosen password and language', async () => {
    const api = installFakeApi(fetchMock, {
      'POST /auth/invitation/check': () => ({ email: 'proche@example.org' }),
      'POST /auth/invitation/accept': () => ({
        ...testProfile,
        email: 'proche@example.org',
      }),
    })
    const wrapper = await mountInApp(InvitationPage, {
      route: `/invitation#token=${token}`,
    })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="invitation-form"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.text()).toContain('proche@example.org')

    await fill(wrapper, 'invitation-password', 'a brand new password')
    await fill(wrapper, 'invitation-confirmation', 'a brand new password')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(useSessionStore().user?.email).toBe('proche@example.org')
    })
    expect(
      api.requests.find((request) => request.path === '/auth/invitation/accept')
        ?.body,
    ).toEqual({ token, password: 'a brand new password', locale: 'fr' })
  })

  it('refuses two different passwords before calling the API', async () => {
    const api = installFakeApi(fetchMock, {
      'POST /auth/invitation/check': () => ({ email: 'proche@example.org' }),
    })
    const wrapper = await mountInApp(InvitationPage, {
      route: `/invitation#token=${token}`,
    })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="invitation-form"]').exists()).toBe(
        true,
      )
    })

    await fill(wrapper, 'invitation-password', 'a brand new password')
    await fill(wrapper, 'invitation-confirmation', 'another password!!')
    await wrapper.get('form').trigger('submit')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Les deux mots de passe diffèrent')
    })
    expect(
      api.requests.some(
        (request) => request.path === '/auth/invitation/accept',
      ),
    ).toBe(false)
  })
})
