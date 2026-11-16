import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  passkeyAuthenticationOptionsSchema,
  passkeyRegistrationOptionsSchema,
  passkeySchema,
} from '@mint/shared/schemas/passkeys'
import { apiPrefix } from '../app.js'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import { createSoftAuthenticator } from '../tests/webauthn.js'
import { readZip } from '../tests/zip.js'
import type {
  IsolationActors as Actors,
  IsolationResources,
  IsolationScenario as Scenario,
  IsolationSnapshot,
  TestClient as Client,
} from '../types/tests.js'
import { apiRoutes } from './index.js'

const testOrigin = 'http://mint.test'

const isolationMonth = '2026-12-01'

async function snapshotOf(
  client: Client,
  resources: IsolationResources,
): Promise<IsolationSnapshot> {
  return {
    passkeys: (await client.get('/profile/passkeys')).body,
    overview: (await client.get('/accounts/overview')).body,
    paymentMethods: (await client.get('/payment-methods')).body,
    categories: (await client.get('/categories')).body,
    operations: (await client.get('/operations')).body,
    schedules: (await client.get('/schedules')).body,
    occurrences: (
      await client.get(`/schedules/${resources.scheduleId}/occurrences`)
    ).body,
    envelopes: (await client.get('/envelopes')).body,
    envelopeMonth: (await client.get(`/envelopes?month=${isolationMonth}`))
      .body,
    rules: (await client.get('/rules')).body,
    tags: (await client.get('/tags')).body,
    notifications: (await client.get('/notifications')).body,
    notificationPreferences: (await client.get('/notifications/preferences'))
      .body,
    pushDevices: (await client.get('/push/subscriptions')).body,
    interest: (
      await client.get(`/accounts/${resources.savingsAccountId}/interest`)
    ).body,
    valuations: (
      await client.get(`/accounts/${resources.investmentAccountId}/valuations`)
    ).body,
    statements: (
      await client.get(`/accounts/${resources.accountId}/statements`)
    ).body,
    imports: (await client.get(`/accounts/${resources.accountId}/imports`))
      .body,
  }
}

async function expectBobDataUntouched(actors: Actors) {
  expect(await snapshotOf(actors.bobClient, actors.bobResources)).toEqual(
    actors.bobSnapshot,
  )
}

function crossRead(path: (resources: IsolationResources) => string): Scenario {
  return async (actors) => {
    const response = await actors.aliceClient.get(path(actors.bobResources))
    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'not_found' })
  }
}

function expectNotFound(response: { status: number; body: unknown }): void {
  expect(response.status).toBe(404)
  expect(response.body).toEqual({ error: 'not_found' })
}

const isolationMapping = {
  delimiter: 'semicolon',
  encoding: 'utf-8',
  hasHeader: true,
  skipTop: 0,
  skipBottom: 0,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: 'comma',
  colDate: 0,
  colLabel: 1,
  colAmount: 2,
  colDebit: null,
  colCredit: null,
}

function aliceRule(accountId: string | null, categoryId: string) {
  return {
    matchType: 'contains',
    pattern: 'ALICE',
    accountId,
    sign: 'any',
    amountMinCents: null,
    amountMaxCents: null,
    categoryId,
    transferAccountId: null,
    active: true,
  }
}

function aliceOperation(accountId: string) {
  return {
    accountId,
    paymentMethodId: null,
    date: '2026-11-05',
    amountCents: -1_000,
    label: 'Alice',
    note: null,
    categoryId: null,
  }
}

function aliceSchedule(accountId: string, categoryId: string) {
  return {
    kind: 'expense',
    label: 'Alice',
    amountCents: 1_000,
    triggerMode: 'auto',
    note: null,
    active: true,
    frequency: 'monthly',
    interval: 1,
    startDate: '2026-12-01',
    anchorLastDay: false,
    endDate: null,
    maxOccurrences: null,
    businessDayRule: 'exact',
    accountId,
    paymentMethodId: null,
    categoryId,
    isSubscription: false,
  }
}

function aliceEnvelope(accountId: string, categoryIds: string[]) {
  return {
    label: 'Alice',
    monthlyAmountCents: 1_000,
    accountId,
    paymentMethodId: null,
    carryOver: false,
    active: true,
    categoryIds,
  }
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
  'get /accounts/:id/usage': crossRead(
    ({ accountId }) => `/accounts/${accountId}/usage`,
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
  'delete /categories/:id': async (actors) => {
    await crossAccess(
      'delete',
      ({ categoryId }) => `/categories/${categoryId}`,
    )(actors)
    const aliceAccount = await createAliceAccount(actors)
    const travel = await findAliceCategory(actors, 'Voyages')
    await actors.aliceClient.post('/operations', {
      ...aliceOperation(aliceAccount),
      categoryId: travel.id,
    })
    expectNotFound(
      await actors.aliceClient.delete(
        `/categories/${travel.id}?replacementId=${actors.bobResources.categoryId}`,
      ),
    )
    await expectBobDataUntouched(actors)
  },
  'get /categories/:id/usage': crossRead(
    ({ categoryId }) => `/categories/${categoryId}/usage`,
  ),
  'get /payment-methods/:id/usage': crossRead(
    ({ paymentMethodId }) => `/payment-methods/${paymentMethodId}/usage`,
  ),
  'get /operations': async (actors) => {
    await ownListOnly('/operations')(actors)
    const filtered = await actors.aliceClient.get(
      `/operations?accountIds=${actors.bobResources.accountId}&categoryIds=${actors.bobResources.categoryId}`,
    )
    expect(filtered.body.items).toEqual([])
    const tagged = await actors.aliceClient.get(
      `/operations?tagIds=${actors.bobResources.tagId}`,
    )
    expect(tagged.body.items).toEqual([])
  },
  'post /operations': async (actors) => {
    const aliceAccount = await createAliceAccount(actors)
    const { accountId, paymentMethodId, categoryId } = actors.bobResources
    expectNotFound(
      await actors.aliceClient.post('/operations', aliceOperation(accountId)),
    )
    expectNotFound(
      await actors.aliceClient.post('/operations', {
        ...aliceOperation(aliceAccount),
        paymentMethodId,
      }),
    )
    expectNotFound(
      await actors.aliceClient.post('/operations', {
        ...aliceOperation(aliceAccount),
        categoryId,
      }),
    )
    expectNotFound(
      await actors.aliceClient.post('/operations', {
        ...aliceOperation(aliceAccount),
        tagIds: [actors.bobResources.tagId],
      }),
    )
    await expectBobDataUntouched(actors)
  },
  'patch /operations/:id': async (actors) => {
    await crossAccess(
      'patch',
      ({ operationId }) => `/operations/${operationId}`,
      () => ({ label: 'Taken over' }),
    )(actors)
    const aliceAccount = await createAliceAccount(actors)
    const own = await actors.aliceClient.post(
      '/operations',
      aliceOperation(aliceAccount),
    )
    expectNotFound(
      await actors.aliceClient.patch(`/operations/${own.body.id}`, {
        accountId: actors.bobResources.accountId,
      }),
    )
    await expectBobDataUntouched(actors)
  },
  'delete /operations/:id': crossAccess(
    'delete',
    ({ operationId }) => `/operations/${operationId}`,
  ),
  'post /transfers': async (actors) => {
    const aliceAccount = await createAliceAccount(actors)
    expectNotFound(
      await actors.aliceClient.post('/transfers', {
        sourceAccountId: aliceAccount,
        targetAccountId: actors.bobResources.accountId,
        date: '2026-11-06',
        amountCents: 1_000,
        label: 'Leak',
        note: null,
      }),
    )
    const aliceSavings = await createAliceAccount(actors)
    expectNotFound(
      await actors.aliceClient.post('/transfers', {
        sourceAccountId: aliceAccount,
        targetAccountId: aliceSavings,
        date: '2026-11-06',
        amountCents: 1_000,
        label: 'Leak',
        note: null,
        tagIds: [actors.bobResources.tagId],
      }),
    )
    await expectBobDataUntouched(actors)
  },
  'patch /transfers/:id': crossAccess(
    'patch',
    ({ transferGroupId }) => `/transfers/${transferGroupId}`,
    () => ({ amountCents: 1 }),
  ),
  'get /schedules': ownListOnly('/schedules'),
  'get /subscriptions': ownListOnly('/subscriptions'),
  'post /schedules': async (actors) => {
    const aliceAccount = await createAliceAccount(actors)
    const housing = await findAliceCategory(actors, 'Logement')
    const { accountId, paymentMethodId, categoryId } = actors.bobResources
    expectNotFound(
      await actors.aliceClient.post(
        '/schedules',
        aliceSchedule(accountId, housing.id),
      ),
    )
    expectNotFound(
      await actors.aliceClient.post(
        '/schedules',
        aliceSchedule(aliceAccount, categoryId),
      ),
    )
    expectNotFound(
      await actors.aliceClient.post('/schedules', {
        ...aliceSchedule(aliceAccount, housing.id),
        accountId: null,
        paymentMethodId,
      }),
    )
    expectNotFound(
      await actors.aliceClient.post('/schedules', {
        ...aliceSchedule(aliceAccount, housing.id),
        tagIds: [actors.bobResources.tagId],
      }),
    )
    await expectBobDataUntouched(actors)
  },
  'patch /schedules/:id': crossAccess(
    'patch',
    ({ scheduleId }) => `/schedules/${scheduleId}`,
    () => ({ label: 'Taken over' }),
  ),
  'delete /schedules/:id': crossAccess(
    'delete',
    ({ scheduleId }) => `/schedules/${scheduleId}`,
  ),
  'get /schedules/:id/occurrences': crossRead(
    ({ scheduleId }) => `/schedules/${scheduleId}/occurrences`,
  ),
  'post /schedules/:id/occurrences/:originalDate/override': crossAccess(
    'post',
    ({ scheduleId }) =>
      `/schedules/${scheduleId}/occurrences/2026-12-01/override`,
    () => ({ amountCents: 1, effectiveDate: null }),
  ),
  'post /schedules/:id/occurrences/:originalDate/skip': crossAccess(
    'post',
    ({ scheduleId }) => `/schedules/${scheduleId}/occurrences/2026-12-01/skip`,
  ),
  'delete /schedules/:id/occurrences/:originalDate': crossAccess(
    'delete',
    ({ scheduleId }) => `/schedules/${scheduleId}/occurrences/2026-12-01`,
  ),
  'get /envelopes': ownListOnly('/envelopes'),
  'post /envelopes': async (actors) => {
    const aliceAccount = await createAliceAccount(actors)
    const restaurants = await findAliceCategory(actors, 'Restaurants')
    expectNotFound(
      await actors.aliceClient.post(
        '/envelopes',
        aliceEnvelope(actors.bobResources.accountId, [restaurants.id]),
      ),
    )
    expectNotFound(
      await actors.aliceClient.post(
        '/envelopes',
        aliceEnvelope(aliceAccount, [actors.bobResources.envelopeCategoryId]),
      ),
    )
    await expectBobDataUntouched(actors)
  },
  'patch /envelopes/:id': crossAccess(
    'patch',
    ({ envelopeId }) => `/envelopes/${envelopeId}`,
    () => ({ label: 'Taken over' }),
  ),
  'delete /envelopes/:id': crossAccess(
    'delete',
    ({ envelopeId }) => `/envelopes/${envelopeId}`,
  ),
  'post /envelopes/:id/months/:month': crossAccess(
    'post',
    ({ envelopeId }) => `/envelopes/${envelopeId}/months/${isolationMonth}`,
    () => ({ amountCents: 1 }),
  ),
  'delete /envelopes/:id/months/:month': crossAccess(
    'delete',
    ({ envelopeId }) => `/envelopes/${envelopeId}/months/${isolationMonth}`,
  ),
  'get /forecast/curve': crossRead(
    ({ accountId }) => `/forecast/curve?accountId=${accountId}`,
  ),
  'get /calendar/:month': crossRead(
    ({ accountId }) => `/calendar/2026-11-01?accountId=${accountId}`,
  ),
  'get /rules': ownListOnly('/rules'),
  'post /rules': async (actors) => {
    const aliceAccount = await createAliceAccount(actors)
    const leisure = await findAliceCategory(actors, 'Loisirs')
    expectNotFound(
      await actors.aliceClient.post(
        '/rules',
        aliceRule(actors.bobResources.accountId, leisure.id),
      ),
    )
    expectNotFound(
      await actors.aliceClient.post(
        '/rules',
        aliceRule(aliceAccount, actors.bobResources.categoryId),
      ),
    )
    expectNotFound(
      await actors.aliceClient.post('/rules', {
        ...aliceRule(aliceAccount, leisure.id),
        categoryId: null,
        transferAccountId: actors.bobResources.accountId,
      }),
    )
    expectNotFound(
      await actors.aliceClient.post('/rules', {
        ...aliceRule(aliceAccount, leisure.id),
        tagIds: [actors.bobResources.tagId],
      }),
    )
    await expectBobDataUntouched(actors)
  },
  'patch /rules/:id': crossAccess(
    'patch',
    ({ ruleId }) => `/rules/${ruleId}`,
    () => ({ pattern: 'Taken over' }),
  ),
  'delete /rules/:id': crossAccess(
    'delete',
    ({ ruleId }) => `/rules/${ruleId}`,
  ),
  'post /rules/reorder': async (actors) => {
    const response = await actors.aliceClient.post('/rules/reorder', {
      ruleIds: [actors.bobResources.ruleId],
    })
    expect(response.status).toBe(409)
    await expectBobDataUntouched(actors)
  },
  'get /accounts/:id/statements': crossRead(
    ({ accountId }) => `/accounts/${accountId}/statements`,
  ),
  'post /accounts/:id/statements': crossAccess(
    'post',
    ({ accountId }) => `/accounts/${accountId}/statements`,
    () => ({ date: '2026-11-09', balanceCents: 1 }),
  ),
  'post /statements/:id/adjust': crossAccess(
    'post',
    ({ statementId }) => `/statements/${statementId}/adjust`,
  ),
  'delete /statements/:id': crossAccess(
    'delete',
    ({ statementId }) => `/statements/${statementId}`,
  ),
  'post /accounts/:id/imports': async (actors) => {
    expectNotFound(
      await actors.aliceClient.upload(
        `/accounts/${actors.bobResources.accountId}/imports?filename=x.csv`,
        Buffer.from('a;b;c\n'),
      ),
    )
    await expectBobDataUntouched(actors)
  },
  'get /accounts/:id/imports': crossRead(
    ({ accountId }) => `/accounts/${accountId}/imports`,
  ),
  'get /imports/:id': crossRead(
    ({ importBatchId }) => `/imports/${importBatchId}`,
  ),
  'post /imports/:id/preview': crossAccess(
    'post',
    ({ importBatchId }) => `/imports/${importBatchId}/preview`,
    () => ({ mapping: isolationMapping }),
  ),
  'post /imports/:id/validate': crossAccess(
    'post',
    ({ importBatchId }) => `/imports/${importBatchId}/validate`,
    () => ({ mapping: isolationMapping, decisions: [] }),
  ),
  'delete /imports/:id': crossAccess(
    'delete',
    ({ importBatchId }) => `/imports/${importBatchId}`,
  ),
  'post /imports/:id/cancel': crossAccess(
    'post',
    ({ importBatchId }) => `/imports/${importBatchId}/cancel`,
  ),
  'get /operations/:id/candidates': crossRead(
    ({ operationId }) => `/operations/${operationId}/candidates`,
  ),
  'post /operations/:id/reconcile': crossAccess(
    'post',
    ({ operationId }) => `/operations/${operationId}/reconcile`,
    ({ scheduleId }) => ({ scheduleId, originalDate: '2026-12-01' }),
  ),
  'delete /operations/:id/reconcile': crossAccess(
    'delete',
    ({ operationId }) => `/operations/${operationId}/reconcile`,
  ),
  'post /operations/:id/convert-to-transfer': async (actors) => {
    await crossAccess(
      'post',
      ({ operationId }) => `/operations/${operationId}/convert-to-transfer`,
      ({ accountId }) => ({ counterpartAccountId: accountId }),
    )(actors)
    const aliceAccount = await createAliceAccount(actors)
    const own = await actors.aliceClient.post(
      '/operations',
      aliceOperation(aliceAccount),
    )
    expectNotFound(
      await actors.aliceClient.post(
        `/operations/${own.body.id}/convert-to-transfer`,
        { counterpartAccountId: actors.bobResources.accountId },
      ),
    )
    await expectBobDataUntouched(actors)
  },
  'get /dashboard/summary': ownListOnly('/dashboard/summary'),
  'get /dashboard/breakdown': ownListOnly('/dashboard/breakdown'),
  'get /dashboard/monthly': ownListOnly('/dashboard/monthly'),
  'get /rules/suggestion': crossRead(
    ({ operationId }) => `/rules/suggestion?operationId=${operationId}`,
  ),
  'get /tags': ownListOnly('/tags'),
  'post /tags': async (actors) => {
    const response = await actors.aliceClient.post('/tags', {
      name: 'Bob tag',
    })
    expect(response.status).toBe(201)
    expect(response.body.id).not.toBe(actors.bobResources.tagId)
    await expectBobDataUntouched(actors)
  },
  'patch /tags/:id': crossAccess(
    'patch',
    ({ tagId }) => `/tags/${tagId}`,
    () => ({ name: 'Taken over' }),
  ),
  'delete /tags/:id': crossAccess('delete', ({ tagId }) => `/tags/${tagId}`),
  'get /accounts/:id/valuations': crossRead(
    ({ investmentAccountId }) => `/accounts/${investmentAccountId}/valuations`,
  ),
  'post /accounts/:id/valuations': crossAccess(
    'post',
    ({ investmentAccountId }) => `/accounts/${investmentAccountId}/valuations`,
    () => ({ date: '2026-11-09', valueCents: 1 }),
  ),
  'patch /valuations/:id': crossAccess(
    'patch',
    ({ valuationId }) => `/valuations/${valuationId}`,
    () => ({ valueCents: 1 }),
  ),
  'delete /valuations/:id': crossAccess(
    'delete',
    ({ valuationId }) => `/valuations/${valuationId}`,
  ),
  'get /accounts/:id/interest': crossRead(
    ({ savingsAccountId }) => `/accounts/${savingsAccountId}/interest`,
  ),
  'post /accounts/:id/interest-rates': crossAccess(
    'post',
    ({ savingsAccountId }) => `/accounts/${savingsAccountId}/interest-rates`,
    () => ({ effectiveDate: '2026-11-01', annualRatePct: 9 }),
  ),
  'delete /interest-rates/:id': crossAccess(
    'delete',
    ({ interestRateId }) => `/interest-rates/${interestRateId}`,
  ),
  'get /regulated-caps': ownListOnly('/regulated-caps'),
  'get /notifications': ownListOnly('/notifications'),
  'post /notifications/:id/read': crossAccess(
    'post',
    ({ notificationId }) => `/notifications/${notificationId}/read`,
  ),
  'post /notifications/read-all': async (actors) => {
    expect(
      (await actors.aliceClient.post('/notifications/read-all')).status,
    ).toBe(204)
    await expectBobDataUntouched(actors)
  },
  'delete /notifications/:id': crossAccess(
    'delete',
    ({ notificationId }) => `/notifications/${notificationId}`,
  ),
  'get /notifications/preferences': ownListOnly('/notifications/preferences'),
  'patch /notifications/preferences': async (actors) => {
    const response = await actors.aliceClient.patch(
      '/notifications/preferences',
      { lowBalancePush: false, manualReminderPush: false },
    )
    expect(response.status).toBe(200)
    await expectBobDataUntouched(actors)
  },
  'get /push/key': async ({ aliceClient }) => {
    expect((await aliceClient.get('/push/key')).body).toEqual({
      publicKey: null,
    })
  },
  'get /push/subscriptions': ownListOnly('/push/subscriptions'),
  'post /push/subscriptions': async (actors) => {
    const response = await actors.aliceClient.post('/push/subscriptions', {
      endpoint: 'https://push.example.org/alice',
      keys: { p256dh: 'alice-key', auth: 'alice-auth' },
    })
    expect(response.status).toBe(201)
    await expectBobDataUntouched(actors)
  },
  'delete /push/subscriptions/:id': crossAccess(
    'delete',
    ({ pushSubscriptionId }) => `/push/subscriptions/${pushSubscriptionId}`,
  ),
  'post /auth/passkey/options': async (actors) => {
    const response = await actors.anonymous.post('/auth/passkey/options')
    expect(response.status).toBe(200)
    expect(
      passkeyAuthenticationOptionsSchema.parse(response.body).allowCredentials,
    ).toEqual([])
    await expectBobDataUntouched(actors)
  },
  'post /auth/passkey/login': async (actors) => {
    const intruder = createClient(actors.context.server)
    const options = passkeyAuthenticationOptionsSchema.parse(
      (await intruder.post('/auth/passkey/options')).body,
    )
    const forged = createSoftAuthenticator({ origin: testOrigin })
    const assertion = forged.authenticate(options)
    const response = await intruder.post('/auth/passkey/login', {
      response: {
        ...assertion,
        id: actors.bobResources.passkeyCredentialId,
        rawId: actors.bobResources.passkeyCredentialId,
      },
    })
    expect(response.status).toBe(401)
    expect((await intruder.get('/auth/session')).status).toBe(401)
    await expectBobUntouched(actors)
  },
  'get /profile/passkeys': ownListOnly('/profile/passkeys'),
  'post /profile/passkeys/options': async (actors) => {
    const response = await actors.aliceClient.post(
      '/profile/passkeys/options',
      { password: testPassword },
    )
    expect(response.status).toBe(200)
    expect(
      passkeyRegistrationOptionsSchema
        .parse(response.body)
        .excludeCredentials?.map((credential) => credential.id),
    ).not.toContain(actors.bobResources.passkeyCredentialId)
    await expectBobDataUntouched(actors)
  },
  'post /profile/passkeys': async (actors) => {
    const options = passkeyRegistrationOptionsSchema.parse(
      (
        await actors.aliceClient.post('/profile/passkeys/options', {
          password: testPassword,
        })
      ).body,
    )
    const response = await actors.aliceClient.post('/profile/passkeys', {
      name: 'Alice phone',
      response: createSoftAuthenticator({ origin: testOrigin }).register(
        options,
      ),
    })
    expect(response.status).toBe(201)
    await expectBobDataUntouched(actors)
  },
  'patch /profile/passkeys/:id': crossAccess(
    'patch',
    ({ passkeyId }) => `/profile/passkeys/${passkeyId}`,
    () => ({ name: 'Stolen' }),
  ),
  'delete /profile/passkeys/:id': crossAccess(
    'delete',
    ({ passkeyId }) => `/profile/passkeys/${passkeyId}`,
  ),
  'post /profile/export': async (actors) => {
    const response = await actors.aliceClient.agent
      .post(`${apiPrefix}/profile/export`)
      .set('X-CSRF-Token', await actors.aliceClient.csrfToken())
      .send({ password: testPassword })
      .buffer(true)
      .parse((stream, callback) => {
        const chunks: Buffer[] = []
        stream.on('data', (chunk: Buffer) => chunks.push(chunk))
        stream.on('end', () => callback(null, Buffer.concat(chunks)))
      })
    expect(response.status).toBe(200)
    const archive: unknown = response.body
    if (!Buffer.isBuffer(archive)) {
      throw new Error('The export is not binary')
    }
    const content = [...readZip(archive).values()]
      .map((entry) => entry.toString('utf8'))
      .join('\n')
    for (const id of [actors.bob.id, ...collectIds(actors.bobSnapshot)]) {
      expect(content).not.toContain(id)
    }
    expect(content).not.toContain(actors.bob.email)
  },
  'post /profile/delete/options': async (actors) => {
    const response = await actors.aliceClient.post('/profile/delete/options')
    if (response.status === 200) {
      expect(
        passkeyAuthenticationOptionsSchema
          .parse(response.body)
          .allowCredentials?.map((credential) => credential.id),
      ).not.toContain(actors.bobResources.passkeyCredentialId)
    } else {
      expect(response.status).toBe(409)
    }
    await expectBobDataUntouched(actors)
  },
  'post /profile/delete': async (actors) => {
    const carol = await createTestUser(actors.context, {
      email: 'carol@example.org',
    })
    const carolClient = createClient(actors.context.server)
    await carolClient.login(carol.email)
    const response = await carolClient.post('/profile/delete', {
      method: 'password',
      email: carol.email,
      password: testPassword,
    })
    expect(response.status).toBe(204)
    await expectBobUntouched(actors)
    await expectBobDataUntouched(actors)
  },
  'patch /admin/regulated-caps/:product': async (actors) => {
    const asUser = await actors.aliceClient.patch(
      '/admin/regulated-caps/livret_a',
      { capCents: 1 },
    )
    const anonymously = await actors.anonymous.patch(
      '/admin/regulated-caps/livret_a',
      { capCents: 1 },
    )
    expect(asUser.status).toBe(403)
    expect(asUser.body).toEqual({ error: 'forbidden' })
    expect(anonymously.status).toBe(401)
    await expectBobDataUntouched(actors)
  },
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
  const groceries = categories.find((candidate) => candidate.name === 'Courses')
  const savings = await bobClient.post('/accounts', {
    ...aliceAccountInput,
    name: 'Bob savings',
    initialBalanceCents: 0,
  })
  if (
    account.status !== 201 ||
    paymentMethod.status !== 201 ||
    savings.status !== 201 ||
    category === undefined ||
    groceries === undefined
  ) {
    throw new Error('Bob resources could not be created')
  }
  const tag = await bobClient.post('/tags', { name: 'Bob tag' })
  const investment = await bobClient.post('/accounts', {
    ...aliceAccountInput,
    name: 'Bob PEA',
    nature: 'securities_account',
    usage: 'investment',
  })
  const valuation = await bobClient.post(
    `/accounts/${investment.body.id}/valuations`,
    { date: '2026-11-10', valueCents: 2_000 },
  )
  if (investment.status !== 201 || valuation.status !== 201) {
    throw new Error('Bob investment could not be created')
  }
  const savingsAccount = await bobClient.post('/accounts', {
    ...aliceAccountInput,
    name: 'Bob livret',
    nature: 'regulated_savings',
    regulatedProduct: 'livret_a',
    usage: 'savings',
  })
  const interestRate = await bobClient.post(
    `/accounts/${savingsAccount.body.id}/interest-rates`,
    { effectiveDate: '2026-01-01', annualRatePct: 2.4 },
  )
  if (savingsAccount.status !== 201 || interestRate.status !== 201) {
    throw new Error('Bob savings could not be created')
  }
  const pushSubscription = await bobClient.post('/push/subscriptions', {
    endpoint: 'https://push.example.org/bob',
    keys: { p256dh: 'bob-key', auth: 'bob-auth' },
  })
  if (pushSubscription.status !== 201) {
    throw new Error('Bob push subscription could not be created')
  }
  if (tag.status !== 201) {
    throw new Error('Bob tag could not be created')
  }
  const operation = await bobClient.post('/operations', {
    ...aliceOperation(account.body.id),
    label: 'Bob operation',
    categoryId: category.id,
    tagIds: [tag.body.id],
  })
  const transfer = await bobClient.post('/transfers', {
    sourceAccountId: account.body.id,
    targetAccountId: savings.body.id,
    date: '2026-11-06',
    amountCents: 5_000,
    label: 'Bob transfer',
    note: null,
  })
  const schedule = await bobClient.post(
    '/schedules',
    aliceSchedule(account.body.id, category.id),
  )
  const envelope = await bobClient.post(
    '/envelopes',
    aliceEnvelope(account.body.id, [groceries.id]),
  )
  const envelopeMonth = await bobClient.post(
    `/envelopes/${envelope.body.id}/months/${isolationMonth}`,
    { amountCents: 12_345 },
  )
  const statement = await bobClient.post(
    `/accounts/${account.body.id}/statements`,
    { date: '2026-11-10', balanceCents: 100_000 },
  )
  const batch = await bobClient.upload(
    `/accounts/${account.body.id}/imports?filename=bob.csv`,
    Buffer.from('Date;Libelle;Montant\n05/11/2026;BOB;-1,00\n'),
  )
  const rule = await bobClient.post('/rules', {
    ...aliceRule(account.body.id, category.id),
    pattern: 'BOB',
  })
  if (
    operation.status !== 201 ||
    transfer.status !== 201 ||
    schedule.status !== 201 ||
    envelope.status !== 201 ||
    envelopeMonth.status !== 200 ||
    rule.status !== 201 ||
    statement.status !== 201 ||
    batch.status !== 201
  ) {
    throw new Error('Bob planning resources could not be created')
  }
  return {
    accountId: account.body.id,
    paymentMethodId: paymentMethod.body.id,
    categoryId: category.id,
    envelopeCategoryId: groceries.id,
    operationId: operation.body.id,
    transferGroupId: transfer.body.transferGroupId,
    scheduleId: schedule.body.id,
    envelopeId: envelope.body.id,
    ruleId: rule.body.id,
    statementId: statement.body.id,
    importBatchId: batch.body.batch.id,
    tagId: tag.body.id,
    investmentAccountId: investment.body.id,
    valuationId: valuation.body.id,
    savingsAccountId: savingsAccount.body.id,
    interestRateId: interestRate.body.id,
    notificationId: '',
    pushSubscriptionId: pushSubscription.body.id,
    passkeyId: '',
    passkeyCredentialId: '',
  }
}

async function registerBobPasskey(bobClient: Client) {
  const authenticator = createSoftAuthenticator({ origin: testOrigin })
  const options = passkeyRegistrationOptionsSchema.parse(
    (
      await bobClient.post('/profile/passkeys/options', {
        password: testPassword,
      })
    ).body,
  )
  const passkey = passkeySchema.parse(
    (
      await bobClient.post('/profile/passkeys', {
        name: 'Bob phone',
        response: authenticator.register(options),
      })
    ).body,
  )
  return {
    passkeyId: passkey.id,
    passkeyCredentialId: authenticator.credentialId,
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
  const createdResources = await createBobResources(bobClient)
  const notification = await context.dependencies.models.Notification.create({
    userId: bob.id,
    type: 'low_balance',
    dedupKey: 'bob-alert',
    payload: {
      accountId: createdResources.accountId,
      accountName: 'Bob account',
      minDate: '2026-11-15',
      minCents: 1,
      thresholdCents: 2,
    },
  })
  const bobResources = {
    ...createdResources,
    notificationId: notification.id,
    ...(await registerBobPasskey(bobClient)),
  }
  actors = {
    context,
    alice,
    bob,
    aliceClient,
    bobClient,
    anonymous: createClient(context.server),
    bobResources,
    bobSnapshot: await snapshotOf(bobClient, bobResources),
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
