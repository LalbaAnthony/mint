import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '~/app.vue'
import { apiFailure, installFakeApi } from '../fake-api'
import { signIn, signOut, testProfile } from '../session'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  fetchMock.mockReset()
})

describe('API client (NF-SEC-03)', () => {
  it('sends GET requests without CSRF token', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /auth/session': () => testProfile,
    })

    await apiRequest('GET', '/auth/session')

    expect(api.requests).toEqual([
      expect.objectContaining({
        method: 'GET',
        path: '/auth/session',
        headers: {},
      }),
    ])
  })

  it('fetches a CSRF token once and sends it on modifying requests', async () => {
    const api = installFakeApi(fetchMock, {
      'POST /auth/logout': () => undefined,
      'PATCH /profile': () => testProfile,
    })

    await apiCommand('POST', '/auth/logout')
    await apiCommand('PATCH', '/profile', { locale: 'en' })

    expect(
      api.requests.map((request) => `${request.method} ${request.path}`),
    ).toEqual(['GET /csrf', 'POST /auth/logout', 'PATCH /profile'])
    expect(api.requests[2]?.headers).toEqual({ 'X-CSRF-Token': 'csrf-token' })
    expect(api.requests[2]?.body).toEqual({ locale: 'en' })
  })

  it('refreshes the token and retries once on csrf_invalid', async () => {
    let attempts = 0
    const api = installFakeApi(fetchMock, {
      'POST /auth/logout': () => {
        attempts += 1
        return attempts === 1
          ? apiFailure(403, { error: 'csrf_invalid' })
          : undefined
      },
    })

    await apiCommand('POST', '/auth/logout')

    expect(api.requests.map((request) => request.path)).toEqual([
      '/csrf',
      '/auth/logout',
      '/csrf',
      '/auth/logout',
    ])
  })

  it('turns API failures into ApiError with code, issues and delay', async () => {
    installFakeApi(fetchMock, {
      'POST /auth/login': () =>
        apiFailure(429, { error: 'account_locked', retryAfterSeconds: 900 }),
    })

    const failure = await apiCommand('POST', '/auth/login', {}).catch(
      (error: unknown) => error,
    )

    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toEqual(
      expect.objectContaining({
        status: 429,
        code: 'account_locked',
        retryAfterSeconds: 900,
      }),
    )
  })
})

describe('session store', () => {
  it('becomes anonymous on 401 and authenticated on a profile', async () => {
    installFakeApi(fetchMock, {
      'GET /auth/session': () => apiFailure(401, { error: 'unauthenticated' }),
    })
    const session = useSessionStore()

    await session.load()

    expect(session.status).toBe('anonymous')
    expect(session.user).toBeNull()

    installFakeApi(fetchMock, { 'GET /auth/session': () => testProfile })
    await session.load()

    expect(session.status).toBe('authenticated')
    expect(session.user?.email).toBe(testProfile.email)
  })

  it('logs in and out', async () => {
    installFakeApi(fetchMock, {
      'POST /auth/login': () => ({ ...testProfile, role: 'admin' }),
      'POST /auth/logout': () => undefined,
    })
    const session = useSessionStore()
    signOut()

    await session.login('me@example.org', 'correct horse battery')

    expect(session.isAdmin).toBe(true)

    await session.logout()

    expect(session.status).toBe('anonymous')
  })
})

describe('route guard', () => {
  it('sends an anonymous visitor to the login page with the target', async () => {
    installFakeApi(fetchMock, {})
    signOut()

    await mountSuspended(App, { route: '/accounts' })

    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.fullPath).toBe(
        '/login?redirect=/accounts',
      )
    })
  })

  it('keeps a user out of the administration', async () => {
    installFakeApi(fetchMock, {})
    signIn('user')

    await mountSuspended(App, { route: '/admin' })

    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.path).toBe('/')
    })
  })

  it('sends a logged in user away from the login page', async () => {
    installFakeApi(fetchMock, {})
    signIn('user')

    await mountSuspended(App, { route: '/login' })

    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.path).toBe('/')
    })
  })
})

describe('safeRedirect', () => {
  it.each([
    ['/accounts', '/accounts'],
    ['//evil.example', '/'],
    ['https://evil.example', '/'],
    [undefined, '/'],
  ])('maps %s to %s', (target, expected) => {
    expect(safeRedirect(target)).toBe(expected)
  })
})
