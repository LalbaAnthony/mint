import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accountSchema } from '@mint/shared/schemas/accounts'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import type { TestClient, TestContext } from '../types/tests.js'

const minute = 60 * 1000

let context: TestContext
let counter = 0

beforeAll(async () => {
  context = await createTestContext()
})

afterAll(async () => {
  await context.close()
})

async function loggedInUser(locale: 'fr' | 'en' = 'fr') {
  counter += 1
  const user = await createTestUser(context, {
    email: `profile-${counter}@example.org`,
    locale,
  })
  const client = createClient(context.server)
  await client.login(user.email)
  return { user, client }
}

describe('PATCH /api/v1/profile (AUTH-07)', () => {
  it('updates language, theme, forecast horizon and allocation targets (NF-UX-02)', async () => {
    const { client } = await loggedInUser()

    expect((await client.get('/auth/session')).body.theme).toBe('system')

    const response = await client.patch('/profile', {
      locale: 'en',
      theme: 'dark',
      forecastHorizonMonths: 12,
      targets: { needs: 60, wants: 20, save: 20 },
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(
      expect.objectContaining({
        locale: 'en',
        theme: 'dark',
        forecastHorizonMonths: 12,
        targets: { needs: 60, wants: 20, save: 20 },
      }),
    )
    expect((await client.get('/auth/session')).body).toEqual(
      expect.objectContaining({ locale: 'en', theme: 'dark' }),
    )
  })

  it.each([
    [
      { forecastHorizonMonths: 0 },
      ['forecastHorizonMonths'],
      'horizon_out_of_range',
    ],
    [
      { forecastHorizonMonths: 13 },
      ['forecastHorizonMonths'],
      'horizon_out_of_range',
    ],
    [
      { targets: { needs: 50, wants: 30, save: 30 } },
      ['targets'],
      'targets_sum_not_100',
    ],
    [{ locale: 'de' }, ['locale'], 'invalid_locale'],
    [{ theme: 'sepia' }, ['theme'], 'invalid_theme'],
    [{ defaultAccountId: 'current' }, ['defaultAccountId'], 'invalid'],
  ])('rejects %j', async (body, path, message) => {
    const { client } = await loggedInUser()

    const response = await client.patch('/profile', body)

    expect(response.status).toBe(400)
    expect(response.body.issues).toEqual([{ path, message }])
  })

  it('requires a session', async () => {
    const client = createClient(context.server)

    expect((await client.patch('/profile', { locale: 'en' })).status).toBe(401)
  })
})

describe('default account (ADR 0033)', () => {
  async function createAccount(client: TestClient, name: string) {
    const response = await client.post('/accounts', {
      name,
      nature: 'current_account',
      regulatedProduct: null,
      usage: 'current',
      institution: null,
      initialBalanceCents: 0,
      initialBalanceDate: '2026-01-01',
      lowBalanceThresholdCents: null,
    })
    expect(response.status).toBe(201)
    return accountSchema.parse(response.body).id
  }

  async function defaultAccountId(client: TestClient) {
    return (await client.get('/auth/session')).body.defaultAccountId
  }

  it('starts without default account', async () => {
    const { client } = await loggedInUser()

    expect(await defaultAccountId(client)).toBeNull()
  })

  it('sets and clears the default account', async () => {
    const { client } = await loggedInUser()
    await createAccount(client, 'Compte courant')
    const revolut = await createAccount(client, 'Revolut')

    const set = await client.patch('/profile', { defaultAccountId: revolut })

    expect(set.status).toBe(200)
    expect(set.body.defaultAccountId).toBe(revolut)
    expect(await defaultAccountId(client)).toBe(revolut)

    const cleared = await client.patch('/profile', { defaultAccountId: null })

    expect(cleared.status).toBe(200)
    expect(cleared.body.defaultAccountId).toBeNull()
    expect(await defaultAccountId(client)).toBeNull()
  })

  it('keeps the default account when the body leaves it out', async () => {
    const { client } = await loggedInUser()
    const current = await createAccount(client, 'Compte courant')

    const response = await client.patch('/profile', { locale: 'en' })

    expect(response.body.defaultAccountId).toBe(current)
  })

  it('answers 404 for an unknown account', async () => {
    const { client } = await loggedInUser()
    const current = await createAccount(client, 'Compte courant')

    const response = await client.patch('/profile', {
      defaultAccountId: '00000000-0000-4000-8000-000000000000',
    })

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'not_found' })
    expect(await defaultAccountId(client)).toBe(current)
  })

  it('refuses an archived account', async () => {
    const { client } = await loggedInUser()
    const current = await createAccount(client, 'Compte courant')
    const old = await createAccount(client, 'Ancien compte')
    expect((await client.post(`/accounts/${old}/archive`)).status).toBe(200)

    const response = await client.patch('/profile', { defaultAccountId: old })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'account_archived' })
    expect(await defaultAccountId(client)).toBe(current)
  })
})

describe('POST /api/v1/profile/password (AUTH-05)', () => {
  it('refuses a wrong current password', async () => {
    const { client } = await loggedInUser()

    const response = await client.post('/profile/password', {
      currentPassword: 'not my password',
      newPassword: 'a long new password',
    })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'invalid_credentials' })
  })

  it('changes the password and revokes every session, this one included', async () => {
    const { user, client } = await loggedInUser()
    const otherDevice = createClient(context.server)
    await otherDevice.login(user.email)

    const response = await client.post('/profile/password', {
      currentPassword: testPassword,
      newPassword: 'a long new password',
    })

    expect(response.status).toBe(204)
    expect((await client.get('/auth/session')).status).toBe(401)
    expect((await otherDevice.get('/auth/session')).status).toBe(401)
    expect((await client.login(user.email, 'a long new password')).status).toBe(
      200,
    )
  })
})

describe('sessions (AUTH-05)', () => {
  it('lists the active sessions and flags the current one, without secret', async () => {
    const { user, client } = await loggedInUser()
    const otherDevice = createClient(context.server)
    const token = await otherDevice.csrfToken()
    await otherDevice.agent
      .post('/api/v1/auth/login')
      .set('X-CSRF-Token', token)
      .set('User-Agent', 'Phone')
      .send({ email: user.email, password: testPassword })

    const response = await client.get('/profile/sessions')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(2)
    expect(
      response.body.filter((session: { current: boolean }) => session.current),
    ).toHaveLength(1)
    expect(Object.keys(response.body[0]).sort()).toEqual([
      'createdAt',
      'current',
      'id',
      'ip',
      'lastSeenAt',
      'userAgent',
    ])
    expect(
      response.body.map((session: { userAgent: string }) => session.userAgent),
    ).toContain('Phone')
  })

  it('logs out everywhere, this session included', async () => {
    const { user, client } = await loggedInUser()
    const otherDevice = createClient(context.server)
    await otherDevice.login(user.email)

    const response = await client.delete('/profile/sessions')

    expect(response.status).toBe(204)
    expect((await client.get('/auth/session')).status).toBe(401)
    expect((await otherDevice.get('/auth/session')).status).toBe(401)
  })
})

describe('email change (AUTH-07)', () => {
  it('confirms the new address from the link sent to it', async () => {
    const { user, client } = await loggedInUser('en')

    const requested = await client.post('/profile/email', {
      newEmail: 'renamed@example.org',
      password: testPassword,
    })
    const token = context.mailer.tokenSentTo('renamed@example.org')
    const confirmed = await request(context.server)
      .post('/api/v1/auth/email-change/confirm')
      .set('Cookie', '')
      .send({ token })
    const anonymous = createClient(context.server)
    const viaLink = await anonymous.post('/auth/email-change/confirm', {
      token,
    })

    expect(requested.status).toBe(202)
    expect(context.mailer.messages.at(-1)?.subject).toBe(
      'Confirm your new Mint email address',
    )
    expect(confirmed.status).toBe(403)
    expect(viaLink.status).toBe(204)
    expect((await client.get('/auth/session')).body.email).toBe(
      'renamed@example.org',
    )
    await user.reload()
    expect(user.email).toBe('renamed@example.org')
    expect(
      (await anonymous.post('/auth/email-change/confirm', { token })).status,
    ).toBe(404)
  })

  it('requires the current password and a free address', async () => {
    const { client } = await loggedInUser()
    const taken = await createTestUser(context, { email: 'taken@example.org' })

    const wrongPassword = await client.post('/profile/email', {
      newEmail: 'free@example.org',
      password: 'not my password',
    })
    const takenAddress = await client.post('/profile/email', {
      newEmail: taken.email,
      password: testPassword,
    })

    expect(wrongPassword.status).toBe(400)
    expect(takenAddress.status).toBe(409)
    expect(takenAddress.body).toEqual({ error: 'email_taken' })
  })

  it('expires the link after 1 hour', async () => {
    const { client } = await loggedInUser()
    await client.post('/profile/email', {
      newEmail: 'late-change@example.org',
      password: testPassword,
    })
    const token = context.mailer.tokenSentTo('late-change@example.org')

    context.clock.advance(60 * minute)

    expect(
      (await client.post('/auth/email-change/confirm', { token })).status,
    ).toBe(410)
  })

  it('refuses the confirmation if the address was taken meanwhile', async () => {
    const { client } = await loggedInUser()
    await client.post('/profile/email', {
      newEmail: 'race@example.org',
      password: testPassword,
    })
    const token = context.mailer.tokenSentTo('race@example.org')
    await createTestUser(context, { email: 'race@example.org' })

    const response = await client.post('/auth/email-change/confirm', { token })

    expect(response.status).toBe(409)
  })

  it('reports an email that could not be sent', async () => {
    const { client } = await loggedInUser()
    context.mailer.failNext()

    const response = await client.post('/profile/email', {
      newEmail: 'unreachable@example.org',
      password: testPassword,
    })

    expect(response.status).toBe(502)
    expect(response.body).toEqual({ error: 'mail_delivery_failed' })
    expect(
      await context.dependencies.models.EmailChangeToken.count({
        where: { newEmail: 'unreachable@example.org' },
      }),
    ).toBe(0)
  })
})
