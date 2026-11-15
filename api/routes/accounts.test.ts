import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accountOverviewSchema } from '@mint/shared/schemas/accounts'
import type { CreateAccountRequest } from '@mint/shared/types/accounts'
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
    email: `accounts-${counter}@example.org`,
  })
  const client = createClient(context.server)
  await client.login(user.email)
  return client
}

function accountInput(
  overrides: Partial<CreateAccountRequest> = {},
): CreateAccountRequest {
  return {
    name: 'Compte courant',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: 'Crédit Agricole',
    initialBalanceCents: 200_000,
    initialBalanceDate: '2026-11-11',
    lowBalanceThresholdCents: null,
    ...overrides,
  }
}

async function createAccount(
  client: TestClient,
  overrides: Partial<CreateAccountRequest> = {},
): Promise<string> {
  const response = await client.post('/accounts', accountInput(overrides))
  expect(response.status).toBe(201)
  return response.body.id
}

async function overview(client: TestClient) {
  const response = await client.get('/accounts/overview')
  expect(response.status).toBe(200)
  return accountOverviewSchema.parse(response.body)
}

describe('US-04 where my money is (CPT-01, CPT-08)', () => {
  it('shows three usage groups of 2 000, 5 000 and 12 000 EUR and a total of 19 000 EUR', async () => {
    const client = await loggedInClient()
    await createAccount(client, {
      name: 'Livret A',
      nature: 'regulated_savings',
      regulatedProduct: 'livret_a',
      usage: 'savings',
      institution: null,
      initialBalanceCents: 1_200_000,
    })
    await createAccount(client)
    await createAccount(client, {
      name: 'LEP',
      nature: 'regulated_savings',
      regulatedProduct: 'lep',
      usage: 'emergency',
      initialBalanceCents: 500_000,
    })

    const result = await overview(client)

    expect(
      result.groups.map((group) => [
        group.usage,
        group.subtotalCents,
        group.accounts.map((account) => account.name),
      ]),
    ).toEqual([
      ['current', 200_000, ['Compte courant']],
      ['emergency', 500_000, ['LEP']],
      ['savings', 1_200_000, ['Livret A']],
    ])
    expect(result.totalCents).toBe(1_900_000)
  })

  it('returns the stored account with its current balance', async () => {
    const client = await loggedInClient()

    const response = await client.post(
      '/accounts',
      accountInput({ lowBalanceThresholdCents: 20_000 }),
    )

    expect(response.body).toEqual({
      id: expect.any(String),
      name: 'Compte courant',
      nature: 'current_account',
      regulatedProduct: null,
      usage: 'current',
      institution: 'Crédit Agricole',
      initialBalanceCents: 200_000,
      initialBalanceDate: '2026-11-11',
      lowBalanceThresholdCents: 20_000,
      sortOrder: 0,
      archivedAt: null,
      currentBalanceCents: 200_000,
      reconciliationGapCents: null,
    })
  })

  it('returns an empty overview for a new user', async () => {
    const client = await loggedInClient()

    expect(await overview(client)).toEqual({
      totalCents: 0,
      groups: [],
      archived: [],
    })
  })
})

describe('POST /api/v1/accounts validation', () => {
  it.each([
    [
      { nature: 'regulated_savings', regulatedProduct: null },
      ['regulatedProduct'],
      'product_required',
    ],
    [
      { nature: 'regulated_savings', regulatedProduct: 'pel' },
      ['regulatedProduct'],
      'product_mismatch',
    ],
    [
      { nature: 'current_account', regulatedProduct: 'livret_a' },
      ['regulatedProduct'],
      'product_mismatch',
    ],
    [{ name: '   ' }, ['name'], 'required'],
    [{ initialBalanceCents: 12.5 }, ['initialBalanceCents'], 'invalid_amount'],
    [
      { initialBalanceCents: 100_000_000_000 },
      ['initialBalanceCents'],
      'amount_out_of_range',
    ],
    [
      { initialBalanceDate: '11/11/2026' },
      ['initialBalanceDate'],
      'invalid_date',
    ],
    [
      { initialBalanceDate: '2026-11-12' },
      ['initialBalanceDate'],
      'date_in_future',
    ],
    [{ usage: 'retirement' }, ['usage'], 'invalid'],
  ])('rejects %j', async (overrides, path, message) => {
    const client = await loggedInClient()

    const response = await client.post('/accounts', {
      ...accountInput(),
      ...overrides,
    })

    expect(response.status).toBe(400)
    expect(response.body.issues).toEqual([{ path, message }])
    expect((await overview(client)).groups).toEqual([])
  })

  it('accepts a negative initial balance and the PEL product', async () => {
    const client = await loggedInClient()
    await createAccount(client, { initialBalanceCents: -12_550 })
    await createAccount(client, {
      name: 'PEL',
      nature: 'housing_savings',
      regulatedProduct: 'pel',
      usage: 'savings',
      initialBalanceCents: 0,
    })

    expect((await overview(client)).totalCents).toBe(-12_550)
  })

  it('trims the name and the institution', async () => {
    const client = await loggedInClient()

    const response = await client.post(
      '/accounts',
      accountInput({ name: '  Revolut  ', institution: ' Revolut Bank ' }),
    )

    expect(response.body.name).toBe('Revolut')
    expect(response.body.institution).toBe('Revolut Bank')
  })
})

describe('PATCH /api/v1/accounts/:id', () => {
  it('modifies the fields and validates the merged account', async () => {
    const client = await loggedInClient()
    const id = await createAccount(client, {
      name: 'LEP',
      nature: 'regulated_savings',
      regulatedProduct: 'lep',
      usage: 'emergency',
    })

    const renamed = await client.patch(`/accounts/${id}`, {
      name: 'LEP Banque Postale',
      lowBalanceThresholdCents: 10_000,
    })
    const invalid = await client.patch(`/accounts/${id}`, {
      nature: 'current_account',
    })
    const changed = await client.patch(`/accounts/${id}`, {
      nature: 'current_account',
      regulatedProduct: null,
    })

    expect(renamed.status).toBe(200)
    expect(renamed.body).toEqual(
      expect.objectContaining({
        name: 'LEP Banque Postale',
        regulatedProduct: 'lep',
        lowBalanceThresholdCents: 10_000,
      }),
    )
    expect(invalid.status).toBe(400)
    expect(invalid.body.issues).toEqual([
      { path: ['regulatedProduct'], message: 'product_mismatch' },
    ])
    expect(changed.body.nature).toBe('current_account')
  })

  it('places an account last in its new usage', async () => {
    const client = await loggedInClient()
    await createAccount(client, { name: 'Livret', usage: 'savings' })
    await createAccount(client, { name: 'Autre livret', usage: 'savings' })
    const moved = await createAccount(client, { name: 'Courant' })

    const response = await client.patch(`/accounts/${moved}`, {
      usage: 'savings',
    })

    expect(response.body.sortOrder).toBe(2)
    expect(
      (await overview(client)).groups.map((group) =>
        group.accounts.map((account) => account.name),
      ),
    ).toEqual([['Livret', 'Autre livret', 'Courant']])
  })

  it('refuses to modify an archived account', async () => {
    const client = await loggedInClient()
    const id = await createAccount(client)
    await client.post(`/accounts/${id}/archive`)

    const response = await client.patch(`/accounts/${id}`, { name: 'Autre' })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'archived' })
  })

  it('answers 404 for an unknown account', async () => {
    const client = await loggedInClient()

    const response = await client.patch(
      '/accounts/00000000-0000-4000-8000-000000000000',
      { name: 'Autre' },
    )

    expect(response.status).toBe(404)
  })
})

describe('archive, restore and delete (CPT-07)', () => {
  it('archives an account with its active payment methods and leaves it out of the totals', async () => {
    const client = await loggedInClient()
    const kept = await createAccount(client, { initialBalanceCents: 1_000 })
    const archived = await createAccount(client, { initialBalanceCents: 5_000 })
    const card = await client.post('/payment-methods', {
      label: 'Carte',
      kind: 'card',
      accountId: archived,
    })
    const keptCard = await client.post('/payment-methods', {
      label: 'Carte gardée',
      kind: 'card',
      accountId: kept,
    })

    const response = await client.post(`/accounts/${archived}/archive`)

    expect(response.status).toBe(200)
    expect(response.body.archivedAt).toBe('2026-11-11T10:00:00.000Z')
    const result = await overview(client)
    expect(result.totalCents).toBe(1_000)
    expect(result.archived.map((account) => account.id)).toEqual([archived])
    const methods = (await client.get('/payment-methods')).body
    expect(
      methods.map((method: { id: string; archivedAt: string | null }) => [
        method.id,
        method.archivedAt,
      ]),
    ).toEqual([
      [card.body.id, '2026-11-11T10:00:00.000Z'],
      [keptCard.body.id, null],
    ])
    expect((await client.post(`/accounts/${archived}/archive`)).body).toEqual({
      error: 'archived',
    })
  })

  it('restores an account last in its usage, its payment methods staying archived', async () => {
    const client = await loggedInClient()
    const restored = await createAccount(client, { name: 'Premier' })
    await createAccount(client, { name: 'Second' })
    const card = await client.post('/payment-methods', {
      label: 'Carte',
      kind: 'card',
      accountId: restored,
    })
    await client.post(`/accounts/${restored}/archive`)

    const response = await client.post(`/accounts/${restored}/restore`)

    expect(response.status).toBe(200)
    expect(response.body.archivedAt).toBeNull()
    expect(
      (await overview(client)).groups[0]?.accounts.map(
        (account) => account.name,
      ),
    ).toEqual(['Second', 'Premier'])
    const methods = (await client.get('/payment-methods')).body
    expect(methods[0].id).toBe(card.body.id)
    expect(methods[0].archivedAt).not.toBeNull()
    expect((await client.post(`/accounts/${restored}/restore`)).body).toEqual({
      error: 'not_archived',
    })
  })

  it('deletes an account without operations together with its payment methods', async () => {
    const client = await loggedInClient()
    const id = await createAccount(client)
    await client.post('/payment-methods', {
      label: 'Carte',
      kind: 'card',
      accountId: id,
    })

    const response = await client.delete(`/accounts/${id}`)

    expect(response.status).toBe(204)
    expect((await overview(client)).groups).toEqual([])
    expect((await client.get('/payment-methods')).body).toEqual([])
    expect((await client.delete(`/accounts/${id}`)).status).toBe(404)
  })
})

describe('POST /api/v1/accounts/reorder', () => {
  it('orders the active accounts of one usage', async () => {
    const client = await loggedInClient()
    const first = await createAccount(client, { name: 'A' })
    const second = await createAccount(client, { name: 'B' })
    const third = await createAccount(client, { name: 'C' })
    await createAccount(client, { name: 'Livret', usage: 'savings' })

    const response = await client.post('/accounts/reorder', {
      usage: 'current',
      accountIds: [third, first, second],
    })

    expect(response.status).toBe(204)
    expect(
      (await overview(client)).groups.map((group) =>
        group.accounts.map((account) => account.name),
      ),
    ).toEqual([['C', 'A', 'B'], ['Livret']])
  })

  it.each([
    ['a missing account', (ids: string[]) => ids.slice(0, 1)],
    ['a duplicated account', (ids: string[]) => [ids[0], ids[0]]],
    [
      'an unknown account',
      (ids: string[]) => [ids[0], '00000000-0000-4000-8000-000000000000'],
    ],
  ])('refuses a list with %s', async (_case, build) => {
    const client = await loggedInClient()
    const ids = [
      await createAccount(client, { name: 'A' }),
      await createAccount(client, { name: 'B' }),
    ]

    const response = await client.post('/accounts/reorder', {
      usage: 'current',
      accountIds: build(ids),
    })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'order_mismatch' })
  })

  it('excludes archived accounts from the list to order', async () => {
    const client = await loggedInClient()
    const kept = await createAccount(client, { name: 'A' })
    const archived = await createAccount(client, { name: 'B' })
    await client.post(`/accounts/${archived}/archive`)

    expect(
      (
        await client.post('/accounts/reorder', {
          usage: 'current',
          accountIds: [kept, archived],
        })
      ).status,
    ).toBe(409)
    expect(
      (
        await client.post('/accounts/reorder', {
          usage: 'current',
          accountIds: [kept],
        })
      ).status,
    ).toBe(204)
  })
})
