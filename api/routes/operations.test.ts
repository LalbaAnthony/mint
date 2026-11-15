import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accountOverviewSchema } from '@mint/shared/schemas/accounts'
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createPaymentMethod,
  createSavingsAccount,
  createSubcategory,
  operationBody,
  signedInClient,
  transferBody,
} from '../tests/fixtures.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'operations')
}

async function balanceOf(user: TestClient, accountId: string) {
  const overview = accountOverviewSchema.parse(
    (await user.get('/accounts/overview')).body,
  )
  return [
    ...overview.groups.flatMap((group) => group.accounts),
    ...overview.archived,
  ].find((account) => account.id === accountId)?.currentBalanceCents
}

async function list(user: TestClient, query = '') {
  const response = await user.get(`/operations${query}`)
  expect(response.status).toBe(200)
  return operationListResponseSchema.parse(response.body)
}

describe('OPE-01 record an expense or an income', () => {
  it('records a categorized expense through a card and counts it in the balance (CPT-04)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const cardId = await createPaymentMethod(user, accountId)
    const groceries = await categoryId(user, 'Courses')

    const response = await user.post(
      '/operations',
      operationBody(accountId, {
        paymentMethodId: cardId,
        categoryId: groceries,
        label: '  Marché  ',
        note: '  bio  ',
      }),
    )

    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      id: expect.any(String),
      accountId,
      paymentMethodId: cardId,
      date: '2026-11-05',
      amountCents: -4_500,
      label: 'Marché',
      note: 'bio',
      categoryId: groceries,
      status: 'categorized',
      origin: 'manual',
      transferGroupId: null,
      counterpartAccountId: null,
      scheduleId: null,
    })
    expect(await balanceOf(user, accountId)).toBe(95_500)
  })

  it('leaves an operation without category to categorize (OPE-04) and a future one out of the current balance', async () => {
    const user = await client()
    const accountId = await createAccount(user)

    const response = await user.post(
      '/operations',
      operationBody(accountId, { date: '2026-11-20', amountCents: 2_000 }),
    )

    expect(response.body.status).toBe('to_categorize')
    expect(await balanceOf(user, accountId)).toBe(100_000)
  })

  it('accepts a refund on an expense category and an income debit', async () => {
    const user = await client()
    const accountId = await createAccount(user)

    const refund = await user.post(
      '/operations',
      operationBody(accountId, {
        amountCents: 1_500,
        categoryId: await categoryId(user, 'Courses'),
      }),
    )
    const reversal = await user.post(
      '/operations',
      operationBody(accountId, {
        amountCents: -1_500,
        categoryId: await categoryId(user, 'Salaire'),
      }),
    )

    expect(refund.status).toBe(201)
    expect(reversal.status).toBe(201)
  })

  it.each([
    [
      'a date before the initial balance',
      { date: '2026-10-31' },
      'date',
      'date_before_initial_balance',
    ],
    ['a zero amount', { amountCents: 0 }, 'amountCents', 'amount_zero'],
  ])('rejects %s', async (_case, overrides, path, message) => {
    const user = await client()
    const accountId = await createAccount(user)

    const response = await user.post(
      '/operations',
      operationBody(accountId, overrides),
    )

    expect(response.status).toBe(400)
    expect(response.body.issues).toEqual([{ path: [path], message }])
  })

  it('rejects a payment method of another account and the adjustment category', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const otherId = await createAccount(user, { name: 'Revolut' })
    const otherCard = await createPaymentMethod(user, otherId)

    const mismatch = await user.post(
      '/operations',
      operationBody(accountId, { paymentMethodId: otherCard }),
    )
    const adjustment = await user.post(
      '/operations',
      operationBody(accountId, {
        categoryId: await categoryId(user, 'Ajustement'),
      }),
    )

    expect(mismatch.status).toBe(400)
    expect(mismatch.body.issues).toEqual([
      { path: ['paymentMethodId'], message: 'payment_method_mismatch' },
    ])
    expect(adjustment.body.issues).toEqual([
      { path: ['categoryId'], message: 'adjustment_not_allowed' },
    ])
  })

  it('refuses newly referenced archived items but keeps them on edition', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const cardId = await createPaymentMethod(user, accountId)
    const leisure = await categoryId(user, 'Loisirs')
    const operationId = await createOperation(user, accountId, {
      paymentMethodId: cardId,
      categoryId: leisure,
    })
    await user.post(`/payment-methods/${cardId}/archive`)
    await user.post(`/categories/${leisure}/archive`)

    const withCard = await user.post(
      '/operations',
      operationBody(accountId, { paymentMethodId: cardId }),
    )
    const withCategory = await user.post(
      '/operations',
      operationBody(accountId, { categoryId: leisure }),
    )
    const edited = await user.patch(`/operations/${operationId}`, {
      amountCents: -9_900,
    })
    await user.post(`/accounts/${accountId}/archive`)
    const onArchivedAccount = await user.post(
      '/operations',
      operationBody(accountId),
    )

    expect(withCard.body).toEqual({ error: 'payment_method_archived' })
    expect(withCategory.body).toEqual({ error: 'category_archived' })
    expect(edited.status).toBe(200)
    expect(edited.body.amountCents).toBe(-9_900)
    expect(onArchivedAccount.body).toEqual({ error: 'account_archived' })
  })
})

describe('OPE-06 modify and delete an operation', () => {
  it('modifies an operation and refuses to treat a transfer movement as one', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)
    const operationId = await createOperation(user, accountId)
    const transfer = await user.post(
      '/transfers',
      transferBody(accountId, savingsId),
    )

    const edited = await user.patch(`/operations/${operationId}`, {
      label: 'Drive',
      categoryId: await categoryId(user, 'Courses'),
    })
    const movement = await user.patch(
      `/operations/${transfer.body.source.id}`,
      { label: 'Nope' },
    )

    expect(edited.body).toEqual(
      expect.objectContaining({ label: 'Drive', status: 'categorized' }),
    )
    expect(movement.status).toBe(409)
    expect(movement.body).toEqual({ error: 'operation_is_transfer' })
  })

  it('deletes an operation', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const operationId = await createOperation(user, accountId)

    expect((await user.delete(`/operations/${operationId}`)).status).toBe(204)
    expect((await list(user)).total).toBe(0)
  })
})

describe('OPE-02 internal transfers', () => {
  it('creates two linked movements without category and moves both balances', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)

    const response = await user.post(
      '/transfers',
      transferBody(accountId, savingsId),
    )

    expect(response.status).toBe(201)
    expect(response.body.source).toEqual(
      expect.objectContaining({
        accountId,
        amountCents: -10_000,
        categoryId: null,
        status: 'categorized',
        transferGroupId: response.body.transferGroupId,
        counterpartAccountId: savingsId,
      }),
    )
    expect(response.body.target).toEqual(
      expect.objectContaining({
        accountId: savingsId,
        amountCents: 10_000,
        counterpartAccountId: accountId,
      }),
    )
    expect(await balanceOf(user, accountId)).toBe(90_000)
    expect(await balanceOf(user, savingsId)).toBe(10_000)
  })

  it('modifies and deletes both movements together', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)
    const created = await user.post(
      '/transfers',
      transferBody(accountId, savingsId),
    )

    const edited = await user.patch(
      `/transfers/${created.body.transferGroupId}`,
      { amountCents: 25_000, date: '2026-11-07' },
    )
    const deleted = await user.delete(`/operations/${created.body.target.id}`)

    expect(edited.body.source).toEqual(
      expect.objectContaining({ amountCents: -25_000, date: '2026-11-07' }),
    )
    expect(edited.body.target.amountCents).toBe(25_000)
    expect(deleted.status).toBe(204)
    expect((await list(user)).total).toBe(0)
  })

  it('rejects a transfer to the same account or before an initial balance', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createAccount(user, {
      name: 'LEP',
      nature: 'regulated_savings',
      regulatedProduct: 'lep',
      usage: 'emergency',
      initialBalanceDate: '2026-11-10',
    })

    const same = await user.post(
      '/transfers',
      transferBody(accountId, accountId),
    )
    const early = await user.post(
      '/transfers',
      transferBody(accountId, savingsId),
    )

    expect(same.body.issues).toEqual([
      { path: ['targetAccountId'], message: 'same_account' },
    ])
    expect(early.body.issues).toEqual([
      { path: ['date'], message: 'date_before_initial_balance' },
    ])
  })
})

describe('OPE-05 list, sort, search and filter', () => {
  it('paginates and sorts by date or by absolute amount', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await createOperation(user, accountId, {
      date: '2026-11-02',
      amountCents: -100,
    })
    await createOperation(user, accountId, {
      date: '2026-11-04',
      amountCents: 9_000,
    })
    await createOperation(user, accountId, {
      date: '2026-11-03',
      amountCents: -5_000,
    })

    const firstPage = await list(user, '?pageSize=25&page=1')
    const byAmount = await list(user, '?sort=amount&order=desc')
    const secondPage = await list(user, '?pageSize=25&page=2')

    expect(firstPage.total).toBe(3)
    expect(firstPage.items.map((item) => item.date)).toEqual([
      '2026-11-04',
      '2026-11-03',
      '2026-11-02',
    ])
    expect(byAmount.items.map((item) => item.amountCents)).toEqual([
      9_000, -5_000, -100,
    ])
    expect(secondPage.items).toEqual([])
  })

  it('combines search, period, account, direction, amount, origin and status filters', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const otherId = await createAccount(user, { name: 'Revolut' })
    await createOperation(user, accountId, {
      label: 'Boulangerie 100%',
      date: '2026-11-02',
      amountCents: -650,
    })
    await createOperation(user, accountId, {
      label: 'Virement',
      note: 'loyer de novembre',
      date: '2026-11-03',
      amountCents: -60_000,
      categoryId: await categoryId(user, 'Logement'),
    })
    await createOperation(user, otherId, {
      label: 'Salaire',
      date: '2026-11-04',
      amountCents: 200_000,
    })

    const labels = async (query: string) =>
      (await list(user, query)).items.map((item) => item.label)

    expect(await labels('?q=100%25')).toEqual(['Boulangerie 100%'])
    expect(await labels('?q=LOYER')).toEqual(['Virement'])
    expect(await labels('?from=2026-11-03&to=2026-11-03')).toEqual(['Virement'])
    expect(await labels(`?accountIds=${otherId}`)).toEqual(['Salaire'])
    expect(await labels('?direction=credit')).toEqual(['Salaire'])
    expect(await labels('?minCents=600&maxCents=60000')).toEqual([
      'Virement',
      'Boulangerie 100%',
    ])
    expect(await labels('?status=categorized')).toEqual(['Virement'])
    expect(await labels('?origins=manual&origins=schedule')).toHaveLength(3)
    expect(await labels('?origins=import')).toEqual([])
  })

  it('filters by category with its subcategories and by group, Save included', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)
    const groceries = await categoryId(user, 'Courses')
    const drive = await createSubcategory(user, groceries, 'Drive')
    await createOperation(user, accountId, {
      label: 'Drive',
      categoryId: drive,
    })
    await createOperation(user, accountId, {
      label: 'Cinéma',
      categoryId: await categoryId(user, 'Loisirs'),
    })
    await user.post('/transfers', transferBody(accountId, savingsId))
    await user.post(
      '/transfers',
      transferBody(savingsId, accountId, { label: 'Retrait' }),
    )

    const labels = async (query: string) =>
      (await list(user, query)).items.map((item) => item.label).sort()

    expect(await labels(`?categoryIds=${groceries}`)).toEqual(['Drive'])
    expect(await labels('?groups=needs')).toEqual(['Drive'])
    expect(await labels('?groups=wants')).toEqual(['Cinéma'])
    expect(await labels('?groups=save')).toEqual(['Epargne', 'Epargne'])
    expect(await labels('?groups=needs&groups=save')).toEqual([
      'Drive',
      'Epargne',
      'Epargne',
    ])
  })

  it('rejects an invalid query', async () => {
    const user = await client()

    const response = await user.get('/operations?pageSize=7&direction=up')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('validation_failed')
  })
})
