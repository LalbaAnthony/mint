import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import type {
  IsolationActors as Actors,
  IsolationScenario as Scenario,
  TestClient as Client,
} from '../types/tests.js'
import { apiRoutes } from './index.js'

async function expectBobUntouched({ context, bob, bobClient }: Actors) {
  const session = await bobClient.get('/auth/session')
  expect(session.status).toBe(200)
  expect(session.body).toEqual(
    expect.objectContaining({ id: bob.id, email: bob.email, locale: 'fr' }),
  )
  const stored = await context.dependencies.models.User.findByPk(bob.id)
  expect(stored?.email).toBe(bob.email)
}

function adminOnly(
  method: 'get' | 'post',
  path: (actors: Actors) => string,
  body?: object,
): Scenario {
  return async (actors) => {
    const call = (client: Client) =>
      method === 'get'
        ? client.get(path(actors))
        : client.post(path(actors), body)

    const asUser = await call(actors.aliceClient)
    const anonymously = await call(actors.anonymous)

    expect(asUser.status).toBe(403)
    expect(asUser.body).toEqual({ error: 'forbidden' })
    expect(anonymously.status).toBe(401)
    await expectBobUntouched(actors)
  }
}

const scenarios: Record<string, Scenario> = {
  'get /health': async ({ aliceClient }) => {
    expect(Object.keys((await aliceClient.get('/health')).body).sort()).toEqual(
      ['checks', 'status'],
    )
  },
  'get /csrf': async ({ aliceClient }) => {
    expect(Object.keys((await aliceClient.get('/csrf')).body)).toEqual([
      'token',
    ])
  },
  'post /auth/login': async (actors) => {
    const response = await actors.aliceClient.login(actors.bob.email, 'guessed')
    expect(response.status).toBe(401)
    await expectBobUntouched(actors)
  },
  'post /auth/logout': async (actors) => {
    const aliceClient = createClient(actors.context.server)
    await aliceClient.login(actors.alice.email)
    expect((await aliceClient.post('/auth/logout')).status).toBe(204)
    await expectBobUntouched(actors)
  },
  'get /auth/session': async ({ alice, aliceClient }) => {
    expect((await aliceClient.get('/auth/session')).body.id).toBe(alice.id)
  },
  'post /auth/invitation/check': async (actors) => {
    const response = await actors.aliceClient.post('/auth/invitation/check', {
      token: 'a'.repeat(43),
    })
    expect(response.status).toBe(404)
    expect(Object.keys(response.body)).toEqual(['error'])
  },
  'post /auth/invitation/accept': async (actors) => {
    const response = await actors.aliceClient.post('/auth/invitation/accept', {
      token: 'a'.repeat(43),
      password: testPassword,
      locale: 'fr',
    })
    expect(response.status).toBe(404)
    await expectBobUntouched(actors)
  },
  'post /auth/password-reset/request': async (actors) => {
    const response = await actors.aliceClient.post(
      '/auth/password-reset/request',
      { email: actors.bob.email },
    )
    expect(response.status).toBe(202)
    expect(response.body).toEqual({})
    await expectBobUntouched(actors)
  },
  'post /auth/password-reset/confirm': async (actors) => {
    const response = await actors.aliceClient.post(
      '/auth/password-reset/confirm',
      { token: 'b'.repeat(43), password: 'a takeover password' },
    )
    expect(response.status).toBe(404)
    expect(
      (await createClient(actors.context.server).login(actors.bob.email))
        .status,
    ).toBe(200)
  },
  'post /auth/email-change/confirm': async (actors) => {
    const response = await actors.aliceClient.post(
      '/auth/email-change/confirm',
      { token: 'c'.repeat(43) },
    )
    expect(response.status).toBe(404)
    await expectBobUntouched(actors)
  },
  'patch /profile': async (actors) => {
    const response = await actors.aliceClient.patch('/profile', {
      locale: 'en',
      forecastHorizonMonths: 6,
    })
    expect(response.body.id).toBe(actors.alice.id)
    await expectBobUntouched(actors)
  },
  'post /profile/password': async (actors) => {
    const aliceClient = createClient(actors.context.server)
    await aliceClient.login(actors.alice.email)
    await aliceClient.post('/profile/password', {
      currentPassword: testPassword,
      newPassword: testPassword,
    })
    await expectBobUntouched(actors)
    expect(
      (await createClient(actors.context.server).login(actors.bob.email))
        .status,
    ).toBe(200)
    await actors.aliceClient.login(actors.alice.email)
  },
  'post /profile/email': async (actors) => {
    const response = await actors.aliceClient.post('/profile/email', {
      newEmail: 'alice-new@example.org',
      password: testPassword,
    })
    expect(response.status).toBe(202)
    const tokens =
      await actors.context.dependencies.models.EmailChangeToken.findAll({
        where: { newEmail: 'alice-new@example.org' },
      })
    expect(tokens.map((token) => token.userId)).toEqual([actors.alice.id])
    await expectBobUntouched(actors)
  },
  'get /profile/sessions': async ({ context, alice, aliceClient }) => {
    const response = await aliceClient.get('/profile/sessions')
    const aliceSessionIds = (
      await context.dependencies.models.Session.findAll({
        where: { userId: alice.id },
      })
    ).map((session) => session.id)
    expect(response.body.length).toBeGreaterThan(0)
    for (const session of response.body) {
      expect(aliceSessionIds).toContain(session.id)
    }
  },
  'delete /profile/sessions': async (actors) => {
    const aliceClient = createClient(actors.context.server)
    await aliceClient.login(actors.alice.email)
    expect((await aliceClient.delete('/profile/sessions')).status).toBe(204)
    await expectBobUntouched(actors)
    await actors.aliceClient.login(actors.alice.email)
  },
  'get /admin/invitations': adminOnly('get', () => '/admin/invitations'),
  'post /admin/invitations': adminOnly('post', () => '/admin/invitations', {
    email: 'intruder@example.org',
  }),
  'post /admin/invitations/:id/resend': adminOnly(
    'post',
    () => '/admin/invitations/00000000-0000-4000-8000-000000000000/resend',
  ),
  'post /admin/invitations/:id/revoke': adminOnly(
    'post',
    () => '/admin/invitations/00000000-0000-4000-8000-000000000000/revoke',
  ),
  'get /admin/users': adminOnly('get', () => '/admin/users'),
  'post /admin/users/:id/disable': adminOnly(
    'post',
    ({ bob }) => `/admin/users/${bob.id}/disable`,
  ),
  'post /admin/users/:id/enable': adminOnly(
    'post',
    ({ bob }) => `/admin/users/${bob.id}/enable`,
  ),
  'post /admin/users/:id/password-reset': adminOnly(
    'post',
    ({ bob }) => `/admin/users/${bob.id}/password-reset`,
  ),
}

let actors: Actors

beforeAll(async () => {
  const context = await createTestContext()
  const alice = await createTestUser(context, { email: 'alice@example.org' })
  const bob = await createTestUser(context, { email: 'bob@example.org' })
  const aliceClient = createClient(context.server)
  const bobClient = createClient(context.server)
  await aliceClient.login(alice.email)
  await bobClient.login(bob.email)
  actors = {
    context,
    alice,
    bob,
    aliceClient,
    bobClient,
    anonymous: createClient(context.server),
  }
})

afterAll(async () => {
  await actors.context.close()
})

describe('US-02 data isolation (NF-SEC-05)', () => {
  it('has a cross-access scenario for every API route', () => {
    expect(
      apiRoutes.map((route) => `${route.method} ${route.path}`).sort(),
    ).toEqual(Object.keys(scenarios).sort())
  })

  it.each(Object.entries(scenarios))(
    'keeps Bob out of reach on %s',
    async (_route, scenario) => {
      await scenario(actors)
    },
  )
})
