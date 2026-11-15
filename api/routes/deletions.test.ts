import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { envelopeMonthResponseSchema } from '@mint/shared/schemas/envelopes'
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import { scheduleListResponseSchema } from '@mint/shared/schemas/schedules'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createPaymentMethod,
  createSchedule,
  createSubcategory,
  envelopeBody,
  expenseScheduleBody,
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
  return signedInClient(context, 'deletions')
}

describe('CPT-07 account deletion', () => {
  it('refuses to delete an account with operations, then one referenced by a schedule or an envelope', async () => {
    const user = await client()
    const withOperations = await createAccount(user)
    await createOperation(user, withOperations)
    const scheduled = await createAccount(user, { name: 'Revolut' })
    const cardId = await createPaymentMethod(user, scheduled)
    await createSchedule(
      user,
      expenseScheduleBody(null, await categoryId(user, 'Logement'), {
        paymentMethodId: cardId,
      }),
    )
    const enveloped = await createAccount(user, { name: 'Boursorama' })
    await user.post(
      '/envelopes',
      envelopeBody(enveloped, [await categoryId(user, 'Courses')]),
    )
    const free = await createAccount(user, { name: 'Libre' })

    expect((await user.get(`/accounts/${scheduled}/usage`)).body).toEqual({
      operations: 0,
      schedules: 1,
      envelopes: 0,
    })
    expect((await user.delete(`/accounts/${withOperations}`)).body).toEqual({
      error: 'account_has_operations',
    })
    expect((await user.delete(`/accounts/${scheduled}`)).body).toEqual({
      error: 'account_in_use',
    })
    expect((await user.delete(`/accounts/${enveloped}`)).body).toEqual({
      error: 'account_in_use',
    })
    expect((await user.delete(`/accounts/${free}`)).status).toBe(204)
  })

  it('refuses to move the initial balance date after existing operations', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await createOperation(user, accountId, { date: '2026-11-03' })

    const later = await user.patch(`/accounts/${accountId}`, {
      initialBalanceDate: '2026-11-04',
    })
    const earlier = await user.patch(`/accounts/${accountId}`, {
      initialBalanceDate: '2026-10-01',
    })

    expect(later.body).toEqual({ error: 'operations_before_initial_balance' })
    expect(earlier.status).toBe(200)
    expect(earlier.body.currentBalanceCents).toBe(95_500)
  })
})

describe('PAY payment method deletion', () => {
  it('refuses to delete a referenced payment method and deletes a free one', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const usedCard = await createPaymentMethod(user, accountId)
    const freeCard = await createPaymentMethod(user, accountId, 'Neuve')
    await createOperation(user, accountId, { paymentMethodId: usedCard })

    expect((await user.get(`/payment-methods/${usedCard}/usage`)).body).toEqual(
      {
        operations: 1,
        schedules: 0,
        envelopes: 0,
      },
    )
    expect((await user.delete(`/payment-methods/${usedCard}`)).body).toEqual({
      error: 'payment_method_in_use',
    })
    expect((await user.delete(`/payment-methods/${freeCard}`)).status).toBe(204)
  })
})

describe('CAT-07 category deletion with reassignment', () => {
  it('requires a replacement for a used category and moves operations, schedules and the envelope to it', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const groceries = await categoryId(user, 'Courses')
    const drive = await createSubcategory(user, groceries, 'Drive')
    const food = await categoryId(user, 'Alimentation')
    await createOperation(user, accountId, { categoryId: drive })
    await createSchedule(user, expenseScheduleBody(accountId, groceries))
    await user.post('/envelopes', envelopeBody(accountId, [groceries]))

    const usage = await user.get(`/categories/${groceries}/usage`)
    const withoutReplacement = await user.delete(`/categories/${groceries}`)
    const otherKind = await user.delete(
      `/categories/${groceries}?replacementId=${await categoryId(user, 'Salaire')}`,
    )
    const ownChild = await user.delete(
      `/categories/${groceries}?replacementId=${drive}`,
    )
    const deleted = await user.delete(
      `/categories/${groceries}?replacementId=${food}`,
    )

    expect(usage.body).toEqual({ operations: 1, schedules: 1, envelopes: 1 })
    expect(withoutReplacement.body).toEqual({ error: 'category_in_use' })
    expect(otherKind.body).toEqual({ error: 'invalid_replacement' })
    expect(ownChild.body).toEqual({ error: 'invalid_replacement' })
    expect(deleted.status).toBe(204)
    const operations = operationListResponseSchema.parse(
      (await user.get('/operations')).body,
    )
    const schedules = scheduleListResponseSchema.parse(
      (await user.get('/schedules')).body,
    )
    const envelopes = envelopeMonthResponseSchema.parse(
      (await user.get('/envelopes')).body,
    )
    expect(operations.items.map((item) => item.categoryId)).toEqual([food])
    expect(schedules.schedules.map((item) => item.categoryId)).toEqual([food])
    expect(envelopes.lines.map((line) => line.envelope.categoryIds)).toEqual([
      [food],
    ])
  })

  it('drops the envelope membership when the replacement already belongs to an envelope', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const groceries = await categoryId(user, 'Courses')
    const food = await categoryId(user, 'Alimentation')
    await user.post('/envelopes', envelopeBody(accountId, [groceries]))
    await user.post(
      '/envelopes',
      envelopeBody(accountId, [food], { label: 'Alimentation' }),
    )

    const deleted = await user.delete(
      `/categories/${groceries}?replacementId=${food}`,
    )
    const envelopes = envelopeMonthResponseSchema.parse(
      (await user.get('/envelopes')).body,
    )

    expect(deleted.status).toBe(204)
    expect(
      envelopes.lines.map((line) => [
        line.envelope.label,
        line.envelope.categoryIds,
      ]),
    ).toEqual([
      ['Courses', []],
      ['Alimentation', [food]],
    ])
  })

  it('deletes an unused category without replacement', async () => {
    const user = await client()

    expect(
      (await user.delete(`/categories/${await categoryId(user, 'Voyages')}`))
        .status,
    ).toBe(204)
  })
})
