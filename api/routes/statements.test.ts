import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { accountOverviewSchema } from '@mint/shared/schemas/accounts'
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import { statementSchema } from '@mint/shared/schemas/statements'
import { createTestContext } from '../tests/context.js'
import {
  createAccount,
  createOperation,
  signedInClient,
} from '../tests/fixtures.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-12-01T10:00:00Z') })
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'statements')
}

async function accountGap(user: TestClient, accountId: string) {
  const overview = accountOverviewSchema.parse(
    (await user.get('/accounts/overview')).body,
  )
  return overview.groups
    .flatMap((group) => group.accounts)
    .find((account) => account.id === accountId)?.reconciliationGapCents
}

describe('US-05 correct a gap with the bank (CPT-05, CPT-08)', () => {
  it('shows a gap of -12.50 EUR, corrects it with an adjustment of the same date and resolves the indicator', async () => {
    const user = await client()
    const accountId = await createAccount(user, {
      initialBalanceCents: 130_000,
    })
    await createOperation(user, accountId, {
      date: '2026-11-20',
      amountCents: -5_000,
    })
    await createOperation(user, accountId, {
      date: '2026-12-01',
      amountCents: -1_000,
    })

    const created = await user.post(`/accounts/${accountId}/statements`, {
      date: '2026-11-30',
      balanceCents: 123_750,
    })

    expect(created.status).toBe(201)
    const statement = statementSchema.parse(created.body)
    expect(statement).toMatchObject({
      date: '2026-11-30',
      balanceCents: 123_750,
      calculatedBalanceCents: 125_000,
      gapCents: -1_250,
      adjustmentOperationId: null,
    })
    expect(await accountGap(user, accountId)).toBe(-1_250)

    const adjusted = await user.post(`/statements/${statement.id}/adjust`)

    expect(adjusted.status).toBe(200)
    expect(adjusted.body).toMatchObject({ gapCents: 0 })
    expect(await accountGap(user, accountId)).toBe(0)
    const operations = operationListResponseSchema.parse(
      (await user.get(`/operations?from=2026-11-30&to=2026-11-30`)).body,
    )
    expect(operations.items).toEqual([
      expect.objectContaining({
        amountCents: -1_250,
        date: '2026-11-30',
        label: 'Ajustement',
        status: 'categorized',
      }),
    ])
    expect(
      (await user.post(`/statements/${statement.id}/adjust`)).body,
    ).toEqual({ error: 'statement_balanced' })
  })

  it('keeps one statement per date, in the past and after the initial balance', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const statement = { date: '2026-11-15', balanceCents: 100_000 }

    expect(
      (await user.post(`/accounts/${accountId}/statements`, statement)).status,
    ).toBe(201)
    expect(
      (await user.post(`/accounts/${accountId}/statements`, statement)).body,
    ).toEqual({ error: 'statement_exists' })
    expect(
      (
        await user.post(`/accounts/${accountId}/statements`, {
          ...statement,
          date: '2026-12-02',
        })
      ).body,
    ).toEqual({
      error: 'validation_failed',
      issues: [{ path: ['date'], message: 'date_in_future' }],
    })
    expect(
      (
        await user.post(`/accounts/${accountId}/statements`, {
          ...statement,
          date: '2026-10-31',
        })
      ).body,
    ).toEqual({
      error: 'validation_failed',
      issues: [{ path: ['date'], message: 'date_before_initial_balance' }],
    })
  })

  it('lists the history latest first and the indicator follows the latest statement', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await user.post(`/accounts/${accountId}/statements`, {
      date: '2026-11-10',
      balanceCents: 90_000,
    })
    const latest = await user.post(`/accounts/${accountId}/statements`, {
      date: '2026-11-20',
      balanceCents: 100_000,
    })

    const history = await user.get(`/accounts/${accountId}/statements`)

    expect(
      history.body.statements.map((item: { date: string }) => item.date),
    ).toEqual(['2026-11-20', '2026-11-10'])
    expect(await accountGap(user, accountId)).toBe(0)
    expect((await user.delete(`/statements/${latest.body.id}`)).status).toBe(
      204,
    )
    expect(await accountGap(user, accountId)).toBe(-10_000)
  })
})
