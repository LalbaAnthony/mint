import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Passkey } from '@mint/shared/types/passkeys'
import PasskeyManager from '~/components/PasskeyManager.vue'
import PersonalDataCard from '~/components/PersonalDataCard.vue'
import LoginPage from '~/pages/login.vue'
import { apiFailure, installFakeApi } from '../fake-api'
import { fillInput, findInBody, submit } from '../planning-fixtures'
import { signOut, testProfile } from '../session'

const { fetchMock, webauthn } = vi.hoisted(() => ({
  fetchMock: vi.fn(),
  webauthn: {
    supported: true,
    startAuthentication: vi.fn(),
    startRegistration: vi.fn(),
  },
}))

mockNuxtImport('$fetch', () => fetchMock)

vi.mock('@simplewebauthn/browser', () => ({
  browserSupportsWebAuthn: () => webauthn.supported,
  startAuthentication: webauthn.startAuthentication,
  startRegistration: webauthn.startRegistration,
  WebAuthnError: class extends Error {
    code = 'ERROR_PASSTHROUGH_SEE_CAUSE_PROPERTY'
  },
}))

const mounted: { unmount: () => void }[] = []

const requestOptions = {
  challenge: 'cmVxdWVzdC1jaGFsbGVuZ2U',
  timeout: 120000,
  rpId: 'mint.test',
  allowCredentials: [],
  userVerification: 'required',
}

const creationOptions = {
  rp: { name: 'Mint', id: 'mint.test' },
  user: { id: 'dXNlcg', name: 'me@example.org', displayName: 'me@example.org' },
  challenge: 'Y3JlYXRpb24tY2hhbGxlbmdl',
  pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
  timeout: 120000,
  excludeCredentials: [],
  authenticatorSelection: {
    residentKey: 'required',
    requireResidentKey: true,
    userVerification: 'required',
  },
  attestation: 'none',
}

const assertion = {
  id: 'Y3JlZA',
  rawId: 'Y3JlZA',
  response: {
    clientDataJSON: 'ZGF0YQ',
    authenticatorData: 'YXV0aA',
    signature: 'c2ln',
  },
  clientExtensionResults: {},
  type: 'public-key',
}

const attestation = {
  id: 'Y3JlZA',
  rawId: 'Y3JlZA',
  response: { clientDataJSON: 'ZGF0YQ', attestationObject: 'YXR0' },
  clientExtensionResults: {},
  type: 'public-key',
}

const phone: Passkey = {
  id: '00000000-0000-4000-8000-000000000301',
  name: 'iPhone',
  createdAt: '2026-11-10T09:00:00.000Z',
  lastUsedAt: null,
}

function cancelled(): Error {
  const error = new Error('The operation either timed out or was not allowed.')
  error.name = 'NotAllowedError'
  return error
}

beforeEach(() => {
  resetCsrfToken()
  webauthn.supported = true
  webauthn.startAuthentication.mockReset()
  webauthn.startRegistration.mockReset()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  vi.restoreAllMocks()
  useToast().clear()
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('passkey login (AUTH-03, US-03, CHG-59)', () => {
  it('signs in without email and lands on the requested view', async () => {
    signOut()
    webauthn.startAuthentication.mockResolvedValue(assertion)
    const api = installFakeApi(fetchMock, {
      'POST /auth/passkey/options': () => requestOptions,
      'POST /auth/passkey/login': () => testProfile,
    })
    const wrapper = await mountSuspended(LoginPage, {
      route: '/login?redirect=/accounts',
    })
    mounted.push(wrapper)

    const button = wrapper.get('[data-testid="login-passkey"]')
    expect(button.text()).toBe('Se connecter avec une passkey')
    await button.trigger('click')

    await vi.waitFor(
      () => {
        expect(useRouter().currentRoute.value.path).toBe('/accounts')
      },
      { timeout: 5_000 },
    )
    expect(webauthn.startAuthentication).toHaveBeenCalledWith({
      optionsJSON: requestOptions,
    })
    expect(
      api.requests.find((request) => request.path === '/auth/passkey/login')
        ?.body,
    ).toEqual({ response: assertion })
    expect(useSessionStore().user?.id).toBe(testProfile.id)
  })

  it('stays on the login screen without error when the user cancels', async () => {
    signOut()
    webauthn.startAuthentication.mockRejectedValue(cancelled())
    const api = installFakeApi(fetchMock, {
      'POST /auth/passkey/options': () => requestOptions,
    })
    const wrapper = await mountSuspended(LoginPage, { route: '/login' })
    mounted.push(wrapper)

    await wrapper.get('[data-testid="login-passkey"]').trigger('click')

    await vi.waitFor(() => {
      expect(webauthn.startAuthentication).toHaveBeenCalled()
    })
    expect(wrapper.find('[data-testid="login-error"]').exists()).toBe(false)
    expect(api.requests.map((request) => request.path)).not.toContain(
      '/auth/passkey/login',
    )
    expect(useSessionStore().user).toBeNull()
  })

  it('explains a refused passkey', async () => {
    signOut()
    webauthn.startAuthentication.mockResolvedValue(assertion)
    installFakeApi(fetchMock, {
      'POST /auth/passkey/options': () => requestOptions,
      'POST /auth/passkey/login': () =>
        apiFailure(401, { error: 'passkey_invalid' }),
    })
    const wrapper = await mountSuspended(LoginPage, { route: '/login' })
    mounted.push(wrapper)

    await wrapper.get('[data-testid="login-passkey"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.get('[data-testid="login-error"]').text()).toContain(
        'Passkey refusée',
      )
    })
  })

  it('hides the passkey button when the browser has no WebAuthn', async () => {
    signOut()
    webauthn.supported = false
    const wrapper = await mountSuspended(LoginPage, { route: '/login' })
    mounted.push(wrapper)

    expect(wrapper.find('[data-testid="login-passkey"]').exists()).toBe(false)
  })
})

describe('passkey manager (AUTH-03)', () => {
  it('adds a named passkey after the password, then lists it', async () => {
    let passkeys: Passkey[] = []
    webauthn.startRegistration.mockResolvedValue(attestation)
    const api = installFakeApi(fetchMock, {
      'GET /profile/passkeys': () => passkeys,
      'POST /profile/passkeys/options': () => creationOptions,
      'POST /profile/passkeys': () => {
        passkeys = [{ ...phone, name: 'Téléphone perso' }]
        return passkeys[0]
      },
    })
    const wrapper = await mountSuspended(PasskeyManager)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="passkeys-empty"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="passkeys-add"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="passkey-form"]')).not.toBeNull()
    })
    await fillInput('[data-testid="passkey-name"]', 'Téléphone perso')
    await fillInput('[data-testid="passkey-password"]', 'correct horse battery')
    submit('[data-testid="passkey-form"]')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Téléphone perso')
    })
    expect(
      api.requests.find(
        (request) => request.path === '/profile/passkeys/options',
      )?.body,
    ).toEqual({ password: 'correct horse battery' })
    expect(webauthn.startRegistration).toHaveBeenCalledWith({
      optionsJSON: creationOptions,
    })
    expect(
      api.requests.find(
        (request) =>
          request.method === 'POST' && request.path === '/profile/passkeys',
      )?.body,
    ).toEqual({ name: 'Téléphone perso', response: attestation })
    expect(wrapper.text()).toContain('dernière utilisation : jamais')
  })

  it('deletes a passkey after confirmation', async () => {
    let passkeys = [phone]
    const api = installFakeApi(fetchMock, {
      'GET /profile/passkeys': () => passkeys,
      [`DELETE /profile/passkeys/${phone.id}`]: () => {
        passkeys = []
        return undefined
      },
    })
    const wrapper = await mountSuspended(PasskeyManager)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('iPhone')
    })

    const menu = wrapper.getComponent({ name: 'UDropdownMenu' })
    const items: unknown = menu.props('items')
    const remove = Array.isArray(items) ? items[1]?.[0] : undefined
    remove?.onSelect()
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        'iPhone ne permettra plus de se connecter.',
      )
    })
    findInBody('[data-testid="confirm-modal-confirm"]')?.click()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="passkeys-empty"]').exists()).toBe(true)
    })
    expect(api.requests.some((request) => request.method === 'DELETE')).toBe(
      true,
    )
  })
})

describe('personal data (AUTH-08, AUTH-09, US-19)', () => {
  it('downloads the export after the password', async () => {
    const createObjectURL = vi
      .spyOn(URL, 'createObjectURL')
      .mockReturnValue('blob:mint-export')
    const revokeObjectURL = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockReturnValue(undefined)
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockReturnValue(undefined)
    const archive = new Blob(['zip'], { type: 'application/zip' })
    const api = installFakeApi(fetchMock, {
      'POST /profile/export': () => archive,
    })
    const wrapper = await mountSuspended(PersonalDataCard)
    mounted.push(wrapper)

    await wrapper.get('[data-testid="personal-data-export"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="export-form"]')).not.toBeNull()
    })
    await fillInput('[data-testid="export-password"]', 'correct horse battery')
    submit('[data-testid="export-form"]')

    await vi.waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledWith(archive)
    })
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mint-export')
    expect(click).toHaveBeenCalledTimes(1)
    expect(
      api.requests.find((request) => request.path === '/profile/export')?.body,
    ).toEqual({ password: 'correct horse battery' })
    expect(
      fetchMock.mock.calls.find(
        ([url]) => url === '/api/v1/profile/export',
      )?.[1],
    ).toEqual(expect.objectContaining({ responseType: 'blob' }))
  })

  it('deletes the account with the email and the password, then leaves', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /profile/passkeys': () => [],
      'POST /profile/delete': () => undefined,
    })
    const wrapper = await mountSuspended(PersonalDataCard)
    mounted.push(wrapper)

    await wrapper.get('[data-testid="personal-data-delete"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="delete-account-form"]')).not.toBeNull()
    })
    expect(findInBody('[data-testid="delete-account-passkey"]')).toBeNull()
    await fillInput('[data-testid="delete-account-email"]', testProfile.email)
    await fillInput(
      '[data-testid="delete-account-password"]',
      'correct horse battery',
    )
    submit('[data-testid="delete-account-form"]')

    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.path).toBe('/login')
    })
    expect(
      api.requests.find((request) => request.path === '/profile/delete')?.body,
    ).toEqual({
      method: 'password',
      email: testProfile.email,
      password: 'correct horse battery',
    })
    expect(useSessionStore().user).toBeNull()
  })

  it('confirms the deletion with a passkey of the user', async () => {
    webauthn.startAuthentication.mockResolvedValue(assertion)
    const api = installFakeApi(fetchMock, {
      'GET /profile/passkeys': () => [phone],
      'POST /profile/delete/options': () => ({
        ...requestOptions,
        allowCredentials: [{ id: 'Y3JlZA', type: 'public-key' }],
      }),
      'POST /profile/delete': () => undefined,
    })
    const wrapper = await mountSuspended(PersonalDataCard)
    mounted.push(wrapper)

    await wrapper.get('[data-testid="personal-data-delete"]').trigger('click')
    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="delete-account-passkey"]'),
      ).not.toBeNull()
    })
    await fillInput('[data-testid="delete-account-email"]', testProfile.email)
    findInBody('[data-testid="delete-account-passkey"]')?.click()

    await vi.waitFor(() => {
      expect(useSessionStore().user).toBeNull()
    })
    expect(
      api.requests.find((request) => request.path === '/profile/delete')?.body,
    ).toEqual({
      method: 'passkey',
      email: testProfile.email,
      response: assertion,
    })
  })

  it('keeps the account when the email does not match', async () => {
    installFakeApi(fetchMock, {
      'GET /profile/passkeys': () => [],
      'POST /profile/delete': () =>
        apiFailure(400, { error: 'email_mismatch' }),
    })
    const wrapper = await mountSuspended(PersonalDataCard)
    mounted.push(wrapper)

    await wrapper.get('[data-testid="personal-data-delete"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="delete-account-form"]')).not.toBeNull()
    })
    await fillInput('[data-testid="delete-account-email"]', 'other@example.org')
    await fillInput(
      '[data-testid="delete-account-password"]',
      'correct horse battery',
    )
    submit('[data-testid="delete-account-form"]')

    await vi.waitFor(() => {
      expect(useToast().toasts.value.map((toast) => toast.title)).toContain(
        "L'adresse saisie ne correspond pas à votre compte.",
      )
    })
    expect(useSessionStore().user?.id).toBe(testProfile.id)
  })
})
