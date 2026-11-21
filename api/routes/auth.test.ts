import request from 'supertest'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import { captureAuditEvents, findSetCookie } from '../tests/http.js'
import type { TestContext } from '../types/tests.js'

const minute = 60 * 1000

let context: TestContext

beforeAll(async () => {
  context = await createTestContext()
})

afterAll(async () => {
  await context.close()
})

afterEach(() => {
  vi.restoreAllMocks()
})

function captureStdout(): string[] {
  const lines: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk))
    return true
  })
  return lines
}

let emailCounter = 0

async function newUser(options: { status?: 'disabled' } = {}) {
  emailCounter += 1
  const user = await createTestUser(context, {
    email: `auth-${emailCounter}@example.org`,
  })
  if (options.status === 'disabled') {
    await user.update({ status: 'disabled' })
  }
  return user
}

describe('CSRF protection (NF-SEC-03)', () => {
  it('issues an HttpOnly SameSite=Strict cookie with the token', async () => {
    const response = await request(context.server).get('/api/v1/csrf')

    expect(response.status).toBe(200)
    expect(response.body.token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const cookie = findSetCookie(response, 'mint-csrf')
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Strict/)
  })

  it('rejects a modifying request without token, even before login', async () => {
    const response = await request(context.server)
      .post('/api/v1/auth/login')
      .send({ email: 'a@example.org', password: testPassword })

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'csrf_invalid' })
  })

  it('rejects a token that does not match the cookie', async () => {
    const client = createClient(context.server)
    await client.csrfToken()
    const other = await request(context.server).get('/api/v1/csrf')

    const response = await client.agent
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', other.body.token)

    expect(response.status).toBe(403)
  })

  it('binds the token to the session once logged in', async () => {
    const user = await newUser()
    const client = createClient(context.server)
    const anonymousToken = await client.csrfToken()
    await client.login(user.email)

    const stale = await client.agent
      .post('/api/v1/auth/logout')
      .set('X-CSRF-Token', anonymousToken)
    const fresh = await client.post('/auth/logout')

    expect(stale.status).toBe(403)
    expect(fresh.status).toBe(204)
  })
})

describe('POST /api/v1/auth/login (AUTH-02, AUTH-05)', () => {
  it('opens a 30-day HttpOnly SameSite=Lax session and records the login', async () => {
    const user = await newUser()
    const client = createClient(context.server)
    const token = await client.csrfToken()
    const lines = captureStdout()

    const response = await client.agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', token)
      .set('User-Agent', 'Vitest browser')
      .send({ email: user.email.toUpperCase(), password: testPassword })

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      id: user.id,
      email: user.email,
      role: 'user',
      locale: 'fr',
      theme: 'system',
      forecastHorizonMonths: 3,
      targets: { needs: 50, wants: 30, save: 20 },
      defaultAccountId: null,
    })
    const cookie = findSetCookie(response, 'mint-session')
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    const expires = Date.parse(cookie?.match(/Expires=([^;]+)/)?.[1] ?? '')
    expect(Math.abs(expires - Date.now() - 30 * 24 * 60 * minute)).toBeLessThan(
      minute,
    )
    await user.reload()
    expect(user.lastLoginAt).toEqual(context.clock.now())
    const sessions = await context.dependencies.models.Session.findAll({
      where: { userId: user.id },
    })
    expect(sessions.map((session) => session.userAgent)).toEqual([
      'Vitest browser',
    ])
    expect(captureAuditEvents(lines)).toContain('audit_login_succeeded')
  })

  it('answers the same 401 for a wrong password and an unknown email', async () => {
    const user = await newUser()
    const client = createClient(context.server)

    const wrongPassword = await client.login(user.email, 'not the password')
    const unknownEmail = await client.login('nobody@example.org')

    expect(wrongPassword.status).toBe(401)
    expect(unknownEmail.status).toBe(401)
    expect(wrongPassword.body).toEqual({ error: 'invalid_credentials' })
    expect(unknownEmail.body).toEqual(wrongPassword.body)
  })

  it('rejects a malformed body with the field issues', async () => {
    const response = await createClient(context.server).post('/auth/login', {
      email: 'not-an-email',
      password: '',
    })

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('validation_failed')
    expect(response.body.issues).toEqual(
      expect.arrayContaining([
        { path: ['email'], message: 'invalid_email' },
        { path: ['password'], message: 'required' },
      ]),
    )
  })

  it('refuses a disabled account once the password is right', async () => {
    const user = await newUser({ status: 'disabled' })

    const response = await createClient(context.server).login(user.email)

    expect(response.status).toBe(403)
    expect(response.body).toEqual({ error: 'account_disabled' })
  })

  it('locks the account 15 minutes after 5 failures in 15 minutes (AUTH-06)', async () => {
    const user = await newUser()
    const client = createClient(context.server)

    for (let failure = 1; failure <= 4; failure += 1) {
      expect((await client.login(user.email, 'wrong password')).status).toBe(
        401,
      )
    }
    const fifth = await client.login(user.email, 'wrong password')
    const rightPasswordWhileLocked = await client.login(user.email)

    expect(fifth.status).toBe(429)
    expect(fifth.body).toEqual({
      error: 'account_locked',
      retryAfterSeconds: 900,
    })
    expect(rightPasswordWhileLocked.status).toBe(429)
    expect(rightPasswordWhileLocked.headers['retry-after']).toBe('900')

    context.clock.advance(15 * minute)

    expect((await client.login(user.email)).status).toBe(200)
  })

  it('locks unknown emails the same way, revealing nothing', async () => {
    const client = createClient(context.server)

    for (let failure = 1; failure <= 4; failure += 1) {
      await client.login('ghost@example.org', 'wrong password')
    }

    expect((await client.login('ghost@example.org')).body).toEqual({
      error: 'account_locked',
      retryAfterSeconds: 900,
    })
  })
})

describe('IP limitation (AUTH-06)', () => {
  it('blocks an address after 20 failures on any account', async () => {
    const isolated = await createTestContext()
    try {
      const client = createClient(isolated.server)
      for (let failure = 1; failure <= 20; failure += 1) {
        await client.login(`spray-${failure}@example.org`, 'wrong password')
      }

      const response = await client.post('/auth/password-reset/request', {
        email: 'someone@example.org',
      })

      expect(response.status).toBe(429)
      expect(response.body.error).toBe('too_many_attempts')
    } finally {
      await isolated.close()
    }
  })
})

describe('GET /api/v1/auth/session', () => {
  it('answers 401 without session', async () => {
    const response = await request(context.server).get('/api/v1/auth/session')

    expect(response.status).toBe(401)
    expect(response.body).toEqual({ error: 'unauthenticated' })
  })

  it('returns the profile, then 401 once the user is disabled', async () => {
    const user = await newUser()
    const client = createClient(context.server)
    await client.login(user.email)

    expect((await client.get('/auth/session')).body.email).toBe(user.email)

    await user.update({ status: 'disabled' })

    expect((await client.get('/auth/session')).status).toBe(401)
  })

  it('slides the expiry at most once a minute', async () => {
    const user = await newUser()
    const client = createClient(context.server)
    await client.login(user.email)
    const { Session } = context.dependencies.models
    const initial = await Session.findOne({ where: { userId: user.id } })

    context.clock.advance(30 * 1000)
    await client.get('/auth/session')
    const unchanged = await Session.findOne({ where: { userId: user.id } })
    context.clock.advance(31 * 1000)
    await client.get('/auth/session')
    const slid = await Session.findOne({ where: { userId: user.id } })

    expect(unchanged?.expiresAt).toEqual(initial?.expiresAt)
    expect(slid?.expiresAt.getTime()).toBe(
      context.clock.now().getTime() + 30 * 24 * 60 * minute,
    )
  })

  it('ignores a session past its expiry', async () => {
    const user = await newUser()
    const client = createClient(context.server)
    await client.login(user.email)

    context.clock.advance(30 * 24 * 60 * minute + 1)

    expect((await client.get('/auth/session')).status).toBe(401)
  })
})

describe('POST /api/v1/auth/logout', () => {
  it('destroys the session and clears its cookie', async () => {
    const user = await newUser()
    const client = createClient(context.server)
    await client.login(user.email)

    const response = await client.post('/auth/logout')

    expect(response.status).toBe(204)
    expect(findSetCookie(response, 'mint-session')).toMatch(
      /Expires=Thu, 01 Jan 1970/,
    )
    expect((await client.get('/auth/session')).status).toBe(401)
    expect(
      await context.dependencies.models.Session.count({
        where: { userId: user.id },
      }),
    ).toBe(0)
  })

  it('answers 204 without session', async () => {
    expect(
      (await createClient(context.server).post('/auth/logout')).status,
    ).toBe(204)
  })
})

describe('secure origin', () => {
  it('uses __Host- cookies with the Secure attribute behind the HTTPS proxy', async () => {
    const secure = await createTestContext({
      appOrigin: 'https://mint.dev-it.app',
    })
    try {
      const user = await createTestUser(secure, { email: 'secure@example.org' })
      const agent = request.agent(secure.server)
      const csrf = await agent
        .get('/api/v1/csrf')
        .set('X-Forwarded-Proto', 'https')

      const response = await agent
        .post('/api/v1/auth/login')
        .set('X-Forwarded-Proto', 'https')
        .set('Cookie', `__Host-mint-csrf=${csrfCookieValue(csrf)}`)
        .set('X-CSRF-Token', csrf.body.token)
        .send({ email: user.email, password: testPassword })

      expect(findSetCookie(csrf, '__Host-mint-csrf')).toMatch(/Secure/)
      expect(response.status).toBe(200)
      expect(findSetCookie(response, '__Host-mint-session')).toMatch(
        /; Path=\/;.*Secure/,
      )
    } finally {
      await secure.close()
    }
  })
})

function csrfCookieValue(response: request.Response): string {
  const cookie = findSetCookie(response, '__Host-mint-csrf') ?? ''
  return cookie.slice(cookie.indexOf('=') + 1, cookie.indexOf(';'))
}
