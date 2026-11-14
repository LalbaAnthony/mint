import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { paymentMethodListResponseSchema } from '@mint/shared/schemas/payment-methods'
import {
  createClient,
  createTestContext,
  createTestUser,
} from '../tests/context.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext
let counter = 0

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

afterAll(async () => {
  await context.close()
})

async function loggedInClient(): Promise<TestClient> {
  counter += 1
  const user = await createTestUser(context, {
    email: `payment-methods-${counter}@example.org`,
  })
  const client = createClient(context.server)
  await client.login(user.email)
  return client
}

async function createAccount(client: TestClient, name: string) {
  const response = await client.post('/accounts', {
    name,
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: null,
    initialBalanceCents: 0,
    initialBalanceDate: '2026-11-01',
    lowBalanceThresholdCents: null,
  })
  expect(response.status).toBe(201)
  const id: string = response.body.id
  return id
}

async function createPaymentMethod(client: TestClient, accountId: string) {
  const response = await client.post('/payment-methods', {
    label: 'Carte CA',
    kind: 'card',
    accountId,
  })
  expect(response.status).toBe(201)
  const id: string = response.body.id
  return id
}

async function list(client: TestClient) {
  return paymentMethodListResponseSchema.parse(
    (await client.get('/payment-methods')).body,
  )
}

describe('PAY-01, PAY-02 create and modify a payment method', () => {
  it('creates a payment method attached to an account', async () => {
    const client = await loggedInClient()
    const accountId = await createAccount(client, 'Compte courant')

    const response = await client.post('/payment-methods', {
      label: '  Carte CA  ',
      kind: 'card',
      accountId,
    })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      id: expect.any(String),
      label: 'Carte CA',
      kind: 'card',
      accountId,
      archivedAt: null,
    })
    expect(await list(client)).toEqual([response.body])
  })

  it.each([
    [{ label: '' }, ['label'], 'required'],
    [{ kind: 'deferred_card' }, ['kind'], 'invalid'],
    [{ accountId: null }, ['accountId'], 'required'],
  ])('rejects %j', async (overrides, path, message) => {
    const client = await loggedInClient()
    const accountId = await createAccount(client, 'Compte')

    const response = await client.post('/payment-methods', {
      label: 'Virement',
      kind: 'transfer_out',
      accountId,
      ...overrides,
    })

    expect(response.status).toBe(400)
    expect(response.body.issues).toEqual([{ path, message }])
  })

  it('refuses an unknown account and an archived account', async () => {
    const client = await loggedInClient()
    const archived = await createAccount(client, 'Ancien compte')
    await client.post(`/accounts/${archived}/archive`)

    const unknown = await client.post('/payment-methods', {
      label: 'Carte',
      kind: 'card',
      accountId: '00000000-0000-4000-8000-000000000000',
    })
    const onArchived = await client.post('/payment-methods', {
      label: 'Carte',
      kind: 'card',
      accountId: archived,
    })

    expect(unknown.status).toBe(404)
    expect(onArchived.status).toBe(409)
    expect(onArchived.body).toEqual({ error: 'account_archived' })
    expect(await list(client)).toEqual([])
  })

  it('modifies the label, the kind and the account', async () => {
    const client = await loggedInClient()
    const first = await createAccount(client, 'Crédit Agricole')
    const second = await createAccount(client, 'Revolut')
    const id = await createPaymentMethod(client, first)

    const response = await client.patch(`/payment-methods/${id}`, {
      label: 'Prélèvements',
      kind: 'third_party',
      accountId: second,
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(
      expect.objectContaining({
        label: 'Prélèvements',
        kind: 'third_party',
        accountId: second,
      }),
    )
  })

  it('refuses to move a payment method to an archived account', async () => {
    const client = await loggedInClient()
    const active = await createAccount(client, 'Actif')
    const archived = await createAccount(client, 'Archivé')
    await client.post(`/accounts/${archived}/archive`)
    const id = await createPaymentMethod(client, active)

    const response = await client.patch(`/payment-methods/${id}`, {
      accountId: archived,
    })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'account_archived' })
  })
})

describe('PAY-05 archive, restore and delete', () => {
  it('archives an expired card, keeps it listed and refuses to modify it', async () => {
    const client = await loggedInClient()
    const accountId = await createAccount(client, 'Compte')
    const id = await createPaymentMethod(client, accountId)

    const archived = await client.post(`/payment-methods/${id}/archive`)
    const modified = await client.patch(`/payment-methods/${id}`, {
      label: 'Nouvelle carte',
    })

    expect(archived.status).toBe(200)
    expect(archived.body.archivedAt).toBe('2026-11-11T10:00:00.000Z')
    expect(modified.status).toBe(409)
    expect(modified.body).toEqual({ error: 'archived' })
    expect((await list(client)).map((method) => method.id)).toEqual([id])
    expect((await client.post(`/payment-methods/${id}/archive`)).status).toBe(
      409,
    )
  })

  it('restores a payment method only when its account is active', async () => {
    const client = await loggedInClient()
    const accountId = await createAccount(client, 'Compte')
    const id = await createPaymentMethod(client, accountId)
    await client.post(`/accounts/${accountId}/archive`)

    const blocked = await client.post(`/payment-methods/${id}/restore`)
    await client.post(`/accounts/${accountId}/restore`)
    const restored = await client.post(`/payment-methods/${id}/restore`)

    expect(blocked.status).toBe(409)
    expect(blocked.body).toEqual({ error: 'account_archived' })
    expect(restored.status).toBe(200)
    expect(restored.body.archivedAt).toBeNull()
    expect((await client.post(`/payment-methods/${id}/restore`)).body).toEqual({
      error: 'not_archived',
    })
  })

  it('deletes an unused payment method', async () => {
    const client = await loggedInClient()
    const accountId = await createAccount(client, 'Compte')
    const id = await createPaymentMethod(client, accountId)

    expect((await client.delete(`/payment-methods/${id}`)).status).toBe(204)
    expect(await list(client)).toEqual([])
    expect((await client.delete(`/payment-methods/${id}`)).status).toBe(404)
  })
})
