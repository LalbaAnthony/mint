import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import type {
  IsolationActors as Actors,
  IsolationResources,
  IsolationScenario as Scenario,
  IsolationSnapshot,
  TestClient as Client,
} from '../types/tests.js'
import { apiRoutes } from './index.js'

async function snapshotOf(client: Client): Promise<IsolationSnapshot> {
  return {
    overview: (await client.get('/accounts/overview')).body,
    paymentMethods: (await client.get('/payment-methods')).body,
    categories: (await client.get('/categories')).body,
  }
}

async function expectBobDataUntouched(actors: Actors) {
  expect(await snapshotOf(actors.bobClient)).toEqual(actors.bobSnapshot)
}

function crossAccess(
  method: 'post' | 'patch' | 'delete',
  path: (resources: IsolationResources) => string,
  body?: (resources: IsolationResources) => object,
): Scenario {
  return async (actors) => {
    const url = path(actors.bobResources)
    const payload = body?.(actors.bobResources)
    const response =
      method === 'post'
        ? await actors.aliceClient.post(url, payload)
        : method === 'patch'
          ? await actors.aliceClient.patch(url, payload)
          : await actors.aliceClient.delete(url)
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'not_found' })
    await expectBobDataUntouched(actors)
  }
}

function collectIds(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(collectIds)
  }
  if (typeof value !== 'object' || value === null) {
    return []
  }
  return Object.entries(value).flatMap(([key, item]) =>
    key === 'id' && typeof item === 'string' ? [item] : collectIds(item),
  )
}

function ownListOnly(path: string): Scenario {
  return async (actors) => {
    const response = await actors.aliceClient.get(path)
    expect(response.status).toBe(200)
    const bobIds = collectIds(actors.bobSnapshot)
    expect(
      collectIds(response.body).filter((id) => bobIds.includes(id)),
    ).toEqual([])
  }
}

const aliceAccountInput = {
  name: 'Compte courant',
  nature: 'current_account',
  regulatedProduct: null,
  usage: 'current',
  institution: null,
  initialBalanceCents: 1_000,
  initialBalanceDate: '2026-11-01',
  lowBalanceThresholdCents: null,
}

async function createAliceAccount(actors: Actors): Promise<string> {
  const response = await actors.aliceClient.post('/accounts', aliceAccountInput)
  expect(response.status).toBe(201)
  return response.body.id
}

async function findAliceCategory(actors: Actors, name: string) {
  const categories: { id: string; name: string }[] = (
    await actors.aliceClient.get('/categories')
  ).body
  const category = categories.find((candidate) => candidate.name === name)
  if (category === undefined) {
    throw new Error(`Alice has no category ${name}`)
  }
  return category
}

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
  'get /accounts/overview': ownListOnly('/accounts/overview'),
  'post /accounts': async (actors) => {
    await createAliceAccount(actors)
    await expectBobDataUntouched(actors)
  },
  'post /accounts/reorder': async (actors) => {
    const aliceAccount = await createAliceAccount(actors)
    const response = await actors.aliceClient.post('/accounts/reorder', {
      usage: 'current',
      accountIds: [actors.bobResources.accountId],
    })
    const mixed = await actors.aliceClient.post('/accounts/reorder', {
      usage: 'current',
      accountIds: [aliceAccount, actors.bobResources.accountId],
    })
    expect(response.status).toBe(409)
    expect(mixed.status).toBe(409)
    await expectBobDataUntouched(actors)
  },
  'patch /accounts/:id': crossAccess(
    'patch',
    ({ accountId }) => `/accounts/${accountId}`,
    () => ({ name: 'Taken over', initialBalanceCents: 0 }),
  ),
  'post /accounts/:id/archive': crossAccess(
    'post',
    ({ accountId }) => `/accounts/${accountId}/archive`,
  ),
  'post /accounts/:id/restore': crossAccess(
    'post',
    ({ accountId }) => `/accounts/${accountId}/restore`,
  ),
  'delete /accounts/:id': crossAccess(
    'delete',
    ({ accountId }) => `/accounts/${accountId}`,
  ),
  'get /payment-methods': ownListOnly('/payment-methods'),
  'post /payment-methods': crossAccess(
    'post',
    () => '/payment-methods',
    ({ accountId }) => ({
      label: 'Intruder card',
      kind: 'card',
      accountId,
    }),
  ),
  'patch /payment-methods/:id': async (actors) => {
    await crossAccess(
      'patch',
      ({ paymentMethodId }) => `/payment-methods/${paymentMethodId}`,
      () => ({ label: 'Taken over' }),
    )(actors)
    const aliceAccount = await createAliceAccount(actors)
    const own = await actors.aliceClient.post('/payment-methods', {
      label: 'Carte',
      kind: 'card',
      accountId: aliceAccount,
    })
    const moved = await actors.aliceClient.patch(
      `/payment-methods/${own.body.id}`,
      { accountId: actors.bobResources.accountId },
    )
    expect(moved.status).toBe(404)
    await expectBobDataUntouched(actors)
  },
  'post /payment-methods/:id/archive': crossAccess(
    'post',
    ({ paymentMethodId }) => `/payment-methods/${paymentMethodId}/archive`,
  ),
  'post /payment-methods/:id/restore': crossAccess(
    'post',
    ({ paymentMethodId }) => `/payment-methods/${paymentMethodId}/restore`,
  ),
  'delete /payment-methods/:id': crossAccess(
    'delete',
    ({ paymentMethodId }) => `/payment-methods/${paymentMethodId}`,
  ),
  'get /categories': ownListOnly('/categories'),
  'post /categories': crossAccess(
    'post',
    () => '/categories',
    ({ categoryId }) => ({
      kind: 'expense',
      name: 'Intruder',
      parentId: categoryId,
      expenseGroup: null,
    }),
  ),
  'post /categories/reorder': async (actors) => {
    const response = await actors.aliceClient.post('/categories/reorder', {
      categoryIds: [actors.bobResources.categoryId],
    })
    expect(response.status).toBe(409)
    await expectBobDataUntouched(actors)
  },
  'patch /categories/:id': async (actors) => {
    await crossAccess(
      'patch',
      ({ categoryId }) => `/categories/${categoryId}`,
      () => ({ name: 'Taken over' }),
    )(actors)
    const housing = await findAliceCategory(actors, 'Logement')
    const own = await actors.aliceClient.post('/categories', {
      kind: 'expense',
      name: 'Loyer',
      parentId: housing.id,
      expenseGroup: null,
    })
    const moved = await actors.aliceClient.patch(`/categories/${own.body.id}`, {
      parentId: actors.bobResources.categoryId,
    })
    expect(moved.status).toBe(404)
    await expectBobDataUntouched(actors)
  },
  'post /categories/:id/archive': crossAccess(
    'post',
    ({ categoryId }) => `/categories/${categoryId}/archive`,
  ),
  'post /categories/:id/restore': crossAccess(
    'post',
    ({ categoryId }) => `/categories/${categoryId}/restore`,
  ),
  'delete /categories/:id': crossAccess(
    'delete',
    ({ categoryId }) => `/categories/${categoryId}`,
  ),
}

async function createBobResources(
  bobClient: Client,
): Promise<IsolationResources> {
  const account = await bobClient.post('/accounts', {
    ...aliceAccountInput,
    name: 'Bob account',
    initialBalanceCents: 123_456,
  })
  const paymentMethod = await bobClient.post('/payment-methods', {
    label: 'Bob card',
    kind: 'card',
    accountId: account.body.id,
  })
  const categories: { id: string; name: string }[] = (
    await bobClient.get('/categories')
  ).body
  const category = categories.find((candidate) => candidate.name === 'Logement')
  if (
    account.status !== 201 ||
    paymentMethod.status !== 201 ||
    category === undefined
  ) {
    throw new Error('Bob resources could not be created')
  }
  return {
    accountId: account.body.id,
    paymentMethodId: paymentMethod.body.id,
    categoryId: category.id,
  }
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
  const bobResources = await createBobResources(bobClient)
  actors = {
    context,
    alice,
    bob,
    aliceClient,
    bobClient,
    anonymous: createClient(context.server),
    bobResources,
    bobSnapshot: await snapshotOf(bobClient),
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
