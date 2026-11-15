import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ruleListResponseSchema } from '@mint/shared/schemas/rules'
import type { CreateRuleRequest } from '@mint/shared/types/rules'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createSavingsAccount,
  readId,
  signedInClient,
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
  return signedInClient(context, 'rules')
}

function ruleBody(overrides: Partial<CreateRuleRequest> = {}) {
  return {
    matchType: 'contains',
    pattern: 'DEEZER',
    accountId: null,
    sign: 'any',
    amountMinCents: null,
    amountMaxCents: null,
    categoryId: null,
    transferAccountId: null,
    active: true,
    ...overrides,
  }
}

async function listRules(user: TestClient) {
  return ruleListResponseSchema.parse((await user.get('/rules')).body)
}

describe('REG-01, REG-02 categorization rules', () => {
  it('creates rules in priority order and reorders them', async () => {
    const user = await client()
    const digital = await categoryId(user, 'Services numériques')
    const first = await user.post('/rules', ruleBody({ categoryId: digital }))
    const second = await user.post(
      '/rules',
      ruleBody({ pattern: 'NETFLIX', categoryId: digital }),
    )

    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({
      priority: 0,
      pattern: 'DEEZER',
      categoryId: digital,
    })
    expect(second.body).toMatchObject({ priority: 1 })

    const reorder = await user.post('/rules/reorder', {
      ruleIds: [readId(second.body), readId(first.body)],
    })
    expect(reorder.status).toBe(204)
    expect((await listRules(user)).map((rule) => rule.pattern)).toEqual([
      'NETFLIX',
      'DEEZER',
    ])
    expect(
      (await user.post('/rules/reorder', { ruleIds: [readId(first.body)] }))
        .body,
    ).toEqual({ error: 'order_mismatch' })
  })

  it('requires exactly one action and refuses an invalid regular expression', async () => {
    const user = await client()
    const digital = await categoryId(user, 'Services numériques')
    const savings = await createSavingsAccount(user)

    const none = await user.post('/rules', ruleBody())
    const both = await user.post(
      '/rules',
      ruleBody({ categoryId: digital, transferAccountId: savings }),
    )
    const invalid = await user.post(
      '/rules',
      ruleBody({ matchType: 'regex', pattern: '(a', categoryId: digital }),
    )
    const backtracking = await user.post(
      '/rules',
      ruleBody({ matchType: 'regex', pattern: '(a)\\1', categoryId: digital }),
    )
    const inverted = await user.post(
      '/rules',
      ruleBody({
        categoryId: digital,
        amountMinCents: 500,
        amountMaxCents: 100,
      }),
    )

    expect(none.status).toBe(400)
    expect(both.status).toBe(400)
    expect(invalid.body).toEqual({
      error: 'validation_failed',
      issues: [{ path: ['pattern'], message: 'invalid_regex' }],
    })
    expect(backtracking.status).toBe(400)
    expect(inverted.status).toBe(400)
  })

  it('classifies into a transfer to another account, never the rule account itself', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const savings = await createSavingsAccount(user)

    const transfer = await user.post(
      '/rules',
      ruleBody({
        pattern: 'VIR EPARGNE',
        accountId: checking,
        transferAccountId: savings,
      }),
    )
    const self = await user.post(
      '/rules',
      ruleBody({ accountId: checking, transferAccountId: checking }),
    )

    expect(transfer.status).toBe(201)
    expect(self.body).toEqual({
      error: 'validation_failed',
      issues: [{ path: ['transferAccountId'], message: 'same_account' }],
    })
  })

  it('refuses the adjustment category and modifies or deletes a rule', async () => {
    const user = await client()
    const categories: { id: string; kind: string }[] = (
      await user.get('/categories')
    ).body
    const adjustment = categories.find((item) => item.kind === 'adjustment')
    const digital = await categoryId(user, 'Services numériques')

    expect(
      (
        await user.post(
          '/rules',
          ruleBody({ categoryId: adjustment?.id ?? null }),
        )
      ).body,
    ).toEqual({
      error: 'validation_failed',
      issues: [{ path: ['categoryId'], message: 'adjustment_not_allowed' }],
    })

    const created = await user.post('/rules', ruleBody({ categoryId: digital }))
    const id = readId(created.body)
    const updated = await user.patch(`/rules/${id}`, {
      matchType: 'starts_with',
      pattern: 'PRLV',
      active: false,
    })
    expect(updated.body).toMatchObject({
      matchType: 'starts_with',
      pattern: 'PRLV',
      active: false,
      categoryId: digital,
    })
    expect((await user.delete(`/rules/${id}`)).status).toBe(204)
    expect(await listRules(user)).toEqual([])
  })

  it('reassigns the rules of a deleted category and counts them in its usage (CAT-07)', async () => {
    const user = await client()
    const leisure = await categoryId(user, 'Loisirs')
    const sport = await categoryId(user, 'Sport')
    await user.post('/rules', ruleBody({ categoryId: leisure }))

    expect((await user.get(`/categories/${leisure}/usage`)).body).toMatchObject(
      {
        rules: 1,
      },
    )
    const deletion = await user.delete(
      `/categories/${leisure}?replacementId=${sport}`,
    )

    expect(deletion.status).toBe(204)
    expect((await listRules(user))[0]?.categoryId).toBe(sport)
  })

  it('blocks the deletion of an account used by a rule', async () => {
    const user = await client()
    const checking = await createAccount(user)
    await user.post(
      '/rules',
      ruleBody({
        accountId: checking,
        categoryId: await categoryId(user, 'Courses'),
      }),
    )

    expect((await user.get(`/accounts/${checking}/usage`)).body).toMatchObject({
      rules: 1,
    })
    expect((await user.delete(`/accounts/${checking}`)).body).toEqual({
      error: 'account_in_use',
    })
  })
})

describe('REG-03 rule suggested from an operation', () => {
  it('needs an operation with a bank label', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const manual = await createOperation(user, checking)

    const response = await user.get(`/rules/suggestion?operationId=${manual}`)

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'operation_without_bank_label' })
  })

  it('removes digits and dates from the bank label and keeps the category and the sign', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const digital = await categoryId(user, 'Services numériques')
    const operationId = await createOperation(user, checking, {
      categoryId: digital,
    })
    await context.dependencies.models.Transaction.update(
      { bankLabel: 'PRLV SEPA DEEZER 06/12 REF 99812' },
      { where: { id: operationId } },
    )

    const response = await user.get(
      `/rules/suggestion?operationId=${operationId}`,
    )

    expect(response.body).toEqual({
      matchType: 'contains',
      pattern: 'PRLV SEPA DEEZER REF',
      accountId: null,
      sign: 'debit',
      categoryId: digital,
      transferAccountId: null,
    })
  })
})
