import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { accountOverviewSchema } from '@mint/shared/schemas/accounts'
import { balanceCurveResponseSchema } from '@mint/shared/schemas/forecast'
import { valuationListResponseSchema } from '@mint/shared/schemas/valuations'
import { createTestContext } from '../tests/context.js'
import {
  createAccount,
  signedInClient,
  transferBody,
} from '../tests/fixtures.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-12-01T10:00:00Z') })
})

beforeEach(() => {
  context.clock.set(new Date('2026-12-01T10:00:00Z'))
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'valuations')
}

async function createPea(user: TestClient): Promise<string> {
  return createAccount(user, {
    name: 'PEA',
    nature: 'securities_account',
    usage: 'investment',
    initialBalanceCents: 100_000,
    initialBalanceDate: '2026-11-01',
  })
}

async function fundPea(user: TestClient, peaId: string): Promise<void> {
  const currentId = await createAccount(user)
  for (const [date, amountCents] of [
    ['2026-11-06', 70_000],
    ['2026-11-20', 50_000],
  ] as const) {
    const response = await user.post(
      '/transfers',
      transferBody(currentId, peaId, { date, amountCents }),
    )
    expect(response.status).toBe(201)
  }
}

async function valuations(user: TestClient, accountId: string) {
  const response = await user.get(`/accounts/${accountId}/valuations`)
  expect(response.status).toBe(200)
  return valuationListResponseSchema.parse(response.body)
}

describe('US-16 investment follow-up (CPT-06)', () => {
  it('shows 2 200 EUR paid in and a latent gain of +330 EUR after a valuation of 2 530 EUR', async () => {
    const user = await client()
    const peaId = await createPea(user)
    await fundPea(user, peaId)

    const created = await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-11-30',
      valueCents: 253_000,
    })

    expect(created.status).toBe(201)
    expect(await valuations(user, peaId)).toEqual({
      valuations: [
        {
          id: created.body.id,
          accountId: peaId,
          date: '2026-11-30',
          valueCents: 253_000,
        },
      ],
      summary: {
        paidInCents: 220_000,
        referenceBalanceCents: 253_000,
        lastValuation: { date: '2026-11-30', valueCents: 253_000 },
        latentGainCents: 33_000,
      },
    })
    const overview = accountOverviewSchema.parse(
      (await user.get('/accounts/overview')).body,
    )
    const investments = overview.groups.find(
      (group) => group.usage === 'investment',
    )
    expect(investments?.subtotalCents).toBe(253_000)
    expect(investments?.accounts[0]?.investment?.latentGainCents).toBe(33_000)
  })

  it('uses the valuation as the balance of its day, the following past days and the start of the forecast', async () => {
    const user = await client()
    const peaId = await createPea(user)
    await fundPea(user, peaId)
    await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-11-25',
      valueCents: 240_000,
    })

    const curve = balanceCurveResponseSchema.parse(
      (await user.get(`/forecast/curve?accountId=${peaId}&horizonMonths=1`))
        .body,
    )

    const balanceOn = (date: string) =>
      curve.points.find((point) => point.date === date)?.balanceCents
    expect(balanceOn('2026-11-24')).toBe(220_000)
    expect(balanceOn('2026-11-25')).toBe(240_000)
    expect(balanceOn('2026-11-30')).toBe(240_000)
    expect(balanceOn('2026-12-01')).toBe(240_000)
  })

  it('shows no gain before the first valuation and keeps the calculated balance', async () => {
    const user = await client()
    const peaId = await createPea(user)

    expect((await valuations(user, peaId)).summary).toEqual({
      paidInCents: 100_000,
      referenceBalanceCents: 100_000,
      lastValuation: null,
      latentGainCents: null,
    })
  })

  it('edits and deletes a valuation', async () => {
    const user = await client()
    const peaId = await createPea(user)
    const created = await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-11-15',
      valueCents: 99_000,
    })

    const updated = await user.patch(`/valuations/${created.body.id}`, {
      date: '2026-11-16',
      valueCents: 101_000,
    })

    expect(updated.status).toBe(200)
    expect(updated.body).toEqual({
      id: created.body.id,
      accountId: peaId,
      date: '2026-11-16',
      valueCents: 101_000,
    })
    expect((await user.delete(`/valuations/${created.body.id}`)).status).toBe(
      204,
    )
    expect((await valuations(user, peaId)).valuations).toEqual([])
  })

  it('refuses a valuation in the future, before the initial balance, twice the same day or on another nature', async () => {
    const user = await client()
    const peaId = await createPea(user)
    const currentId = await createAccount(user)

    const future = await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-12-02',
      valueCents: 1,
    })
    const early = await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-10-31',
      valueCents: 1,
    })
    const negative = await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-11-30',
      valueCents: -1,
    })
    await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-11-30',
      valueCents: 1,
    })
    const twice = await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-11-30',
      valueCents: 2,
    })
    const current = await user.post(`/accounts/${currentId}/valuations`, {
      date: '2026-11-30',
      valueCents: 1,
    })

    expect(future.body.issues).toEqual([
      { path: ['date'], message: 'date_in_future' },
    ])
    expect(early.body.issues).toEqual([
      { path: ['date'], message: 'date_before_initial_balance' },
    ])
    expect(negative.status).toBe(400)
    expect(twice.status).toBe(409)
    expect(twice.body).toEqual({ error: 'valuation_exists' })
    expect(current.status).toBe(409)
    expect(current.body).toEqual({ error: 'account_not_investment' })
    expect((await user.get(`/accounts/${currentId}/valuations`)).body).toEqual({
      error: 'account_not_investment',
    })
  })

  it('refuses to give a non-investment nature to an account that has valuations, and any change on an archived one', async () => {
    const user = await client()
    const peaId = await createPea(user)
    const created = await user.post(`/accounts/${peaId}/valuations`, {
      date: '2026-11-30',
      valueCents: 120_000,
    })

    const renatured = await user.patch(`/accounts/${peaId}`, {
      nature: 'other',
      usage: 'savings',
    })
    const crypto = await user.patch(`/accounts/${peaId}`, {
      nature: 'crypto_wallet',
    })
    await user.post(`/accounts/${peaId}/archive`)
    const archived = await user.delete(`/valuations/${created.body.id}`)

    expect(renatured.status).toBe(409)
    expect(renatured.body).toEqual({ error: 'account_has_valuations' })
    expect(crypto.status).toBe(200)
    expect(archived.status).toBe(409)
    expect(archived.body).toEqual({ error: 'account_archived' })
  })
})
