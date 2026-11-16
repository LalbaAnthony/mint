import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  operationListResponseSchema,
  transferSchema,
} from '@mint/shared/schemas/operations'
import {
  reapplyRulesPreviewSchema,
  ruleListResponseSchema,
} from '@mint/shared/schemas/rules'
import type { CreateOperationRequest } from '@mint/shared/types/operations'
import type { CreateRuleRequest } from '@mint/shared/types/rules'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createSavingsAccount,
  readId,
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
      tagIds: [],
    })
  })
})

describe('REG-05 reapplying the rules to selected operations', () => {
  async function bankOperation(
    user: TestClient,
    accountId: string,
    bankLabel: string,
    overrides: Partial<CreateOperationRequest> = {},
  ): Promise<string> {
    const id = await createOperation(user, accountId, overrides)
    await context.dependencies.models.Transaction.update(
      { bankLabel, origin: 'import' },
      { where: { id } },
    )
    return id
  }

  async function createTag(user: TestClient, name: string): Promise<string> {
    const response = await user.post('/tags', { name })
    expect(response.status).toBe(201)
    return readId(response.body)
  }

  async function preview(user: TestClient, operationIds: string[]) {
    const response = await user.post('/rules/reapply/preview', {
      operationIds,
    })
    expect(response.status).toBe(200)
    return reapplyRulesPreviewSchema.parse(response.body)
  }

  async function operation(user: TestClient, id: string) {
    const list = operationListResponseSchema.parse(
      (await user.get('/operations?pageSize=100')).body,
    )
    const found = list.items.find((item) => item.id === id)
    if (found === undefined) {
      throw new Error(`No operation ${id}`)
    }
    return found
  }

  it('previews then applies the category and the tags of the first matching rule (REG-02, REG-05)', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const digital = await categoryId(user, 'Services numériques')
    const groceries = await categoryId(user, 'Courses')
    const subscription = await createTag(user, 'Abonnement')
    const rule = readId(
      (
        await user.post(
          '/rules',
          ruleBody({ categoryId: digital, tagIds: [subscription] }),
        )
      ).body,
    )
    await user.post(
      '/rules',
      ruleBody({ pattern: 'PRLV', categoryId: groceries }),
    )
    const misfiled = await bankOperation(user, checking, 'PRLV DEEZER 06/12', {
      categoryId: groceries,
    })
    const unmatched = await bankOperation(user, checking, 'CB BOULANGERIE')
    const manual = await createOperation(user, checking)
    const alreadyFiled = await bankOperation(user, checking, 'DEEZER', {
      categoryId: digital,
      tagIds: [subscription],
    })

    const previewed = await preview(user, [
      misfiled,
      unmatched,
      manual,
      alreadyFiled,
    ])

    expect(previewed.changes).toEqual([
      {
        operation: expect.objectContaining({
          id: misfiled,
          categoryId: groceries,
        }),
        after: {
          operationId: misfiled,
          ruleId: rule,
          categoryId: digital,
          transferAccountId: null,
          tagIds: [subscription],
        },
      },
    ])
    expect(previewed.skipped).toEqual([
      { operationId: unmatched, reason: 'no_matching_rule' },
      { operationId: manual, reason: 'no_bank_label' },
      { operationId: alreadyFiled, reason: 'unchanged' },
    ])
    expect((await operation(user, misfiled)).categoryId).toBe(groceries)

    const applied = await user.post('/rules/reapply', {
      changes: previewed.changes.map((change) => change.after),
    })

    expect(applied.status).toBe(200)
    expect(applied.body).toEqual({ updated: 1 })
    expect(await operation(user, misfiled)).toMatchObject({
      categoryId: digital,
      status: 'categorized',
      tagIds: [subscription],
    })

    const replayed = await user.post('/rules/reapply', {
      changes: previewed.changes.map((change) => change.after),
    })

    expect(replayed.status).toBe(409)
    expect(replayed.body).toEqual({ error: 'preview_outdated' })
  })

  it('converts an operation into a transfer linked to its counterpart, and only adds tags to an existing transfer (OPE-07)', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const livret = await createSavingsAccount(user)
    const digital = await categoryId(user, 'Services numériques')
    const savingTag = await createTag(user, 'Epargne')
    const counterpartTag = await createTag(user, 'Livret')
    await user.post(
      '/rules',
      ruleBody({
        pattern: 'VIR EPARGNE',
        transferAccountId: livret,
        tagIds: [savingTag],
      }),
    )
    await user.post(
      '/rules',
      ruleBody({
        pattern: 'VIR LIVRET',
        categoryId: digital,
        tagIds: [savingTag],
      }),
    )
    const outgoing = await bankOperation(user, checking, 'VIR EPARGNE NOV', {
      date: '2026-11-06',
      amountCents: -10_000,
    })
    const incoming = await createOperation(user, livret, {
      date: '2026-11-07',
      amountCents: 10_000,
      tagIds: [counterpartTag],
    })
    const transfer = await user.post(
      '/transfers',
      transferBody(checking, livret),
    )
    const transferSource = transferSchema.parse(transfer.body).source.id
    await context.dependencies.models.Transaction.update(
      { bankLabel: 'VIR LIVRET A' },
      { where: { id: transferSource } },
    )

    const previewed = await preview(user, [outgoing, transferSource])

    expect(previewed.skipped).toEqual([])
    expect(previewed.changes.map((change) => change.after)).toEqual([
      expect.objectContaining({
        operationId: outgoing,
        categoryId: null,
        transferAccountId: livret,
        tagIds: [savingTag, counterpartTag].sort(),
      }),
      expect.objectContaining({
        operationId: transferSource,
        categoryId: null,
        transferAccountId: livret,
        tagIds: [savingTag],
      }),
    ])

    const applied = await user.post('/rules/reapply', {
      changes: previewed.changes.map((change) => change.after),
    })

    expect(applied.body).toEqual({ updated: 2 })
    const converted = await operation(user, outgoing)
    const linked = await operation(user, incoming)
    expect(converted).toMatchObject({
      categoryId: null,
      counterpartAccountId: livret,
      tagIds: [savingTag, counterpartTag].sort(),
    })
    expect(linked.transferGroupId).toBe(converted.transferGroupId)
    expect(linked.tagIds).toEqual([savingTag, counterpartTag].sort())
    const transferred = await operation(user, transferSource)
    expect(transferred).toMatchObject({
      categoryId: null,
      counterpartAccountId: livret,
      tagIds: [savingTag],
    })
  })

  it('skips an operation whose tags would exceed 20, or a transfer towards its own account', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const digital = await categoryId(user, 'Services numériques')
    const tagIds: string[] = []
    for (let index = 0; index < 21; index += 1) {
      tagIds.push(await createTag(user, `Tag ${index}`))
    }
    await user.post(
      '/rules',
      ruleBody({
        pattern: 'DEEZER',
        categoryId: digital,
        tagIds: tagIds.slice(20),
      }),
    )
    await user.post(
      '/rules',
      ruleBody({ pattern: 'VIR', transferAccountId: checking }),
    )
    const crowded = await bankOperation(user, checking, 'DEEZER', {
      tagIds: tagIds.slice(0, 20),
    })
    const toItself = await bankOperation(user, checking, 'VIR INTERNE')

    expect((await preview(user, [crowded, toItself])).skipped).toEqual([
      { operationId: crowded, reason: 'too_many_tags' },
      { operationId: toItself, reason: 'same_account' },
    ])
  })

  it('rejects an empty, oversized or unknown selection', async () => {
    const user = await client()

    const empty = await user.post('/rules/reapply/preview', {
      operationIds: [],
    })
    const oversized = await user.post('/rules/reapply/preview', {
      operationIds: Array.from(
        { length: 51 },
        (_, index) =>
          `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      ),
    })
    const unknown = await user.post('/rules/reapply/preview', {
      operationIds: ['00000000-0000-4000-8000-000000000000'],
    })

    expect(empty.status).toBe(400)
    expect(oversized.status).toBe(400)
    expect(unknown.status).toBe(404)
  })
})
