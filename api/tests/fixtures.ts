import { expect } from 'vitest'
import type { CreateAccountRequest } from '@mint/shared/types/accounts'
import type { EditableCategoryKind } from '@mint/shared/types/categories'
import type { CreateEnvelopeRequest } from '@mint/shared/types/envelopes'
import type {
  CreateOperationRequest,
  CreateTransferRequest,
} from '@mint/shared/types/operations'
import type {
  ExpenseScheduleRequest,
  TestClient,
  TestContext,
} from '../types/tests.js'
import { createClient, createTestUser } from './context.js'

let userCounter = 0

export async function signedInClient(
  context: TestContext,
  prefix: string,
): Promise<TestClient> {
  userCounter += 1
  const user = await createTestUser(context, {
    email: `${prefix}-${userCounter}@example.org`,
  })
  const client = createClient(context.server)
  await client.login(user.email)
  return client
}

function readId(body: unknown): string {
  if (
    typeof body === 'object' &&
    body !== null &&
    'id' in body &&
    typeof body.id === 'string'
  ) {
    return body.id
  }
  throw new Error(`No id in ${JSON.stringify(body)}`)
}

export async function createAccount(
  client: TestClient,
  overrides: Partial<CreateAccountRequest> = {},
): Promise<string> {
  const response = await client.post('/accounts', {
    name: 'Compte courant',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: null,
    initialBalanceCents: 100_000,
    initialBalanceDate: '2026-11-01',
    lowBalanceThresholdCents: null,
    ...overrides,
  })
  expect(response.status).toBe(201)
  return readId(response.body)
}

export async function createSavingsAccount(
  client: TestClient,
  name = 'Livret A',
): Promise<string> {
  return createAccount(client, {
    name,
    nature: 'regulated_savings',
    regulatedProduct: 'livret_a',
    usage: 'savings',
    initialBalanceCents: 0,
  })
}

export async function createPaymentMethod(
  client: TestClient,
  accountId: string,
  label = 'Carte',
): Promise<string> {
  const response = await client.post('/payment-methods', {
    label,
    kind: 'card',
    accountId,
  })
  expect(response.status).toBe(201)
  return readId(response.body)
}

export async function categoryId(
  client: TestClient,
  name: string,
): Promise<string> {
  const response = await client.get('/categories')
  const categories: unknown = response.body
  if (!Array.isArray(categories)) {
    throw new Error('No category list')
  }
  const found: unknown = categories.find(
    (category: unknown) =>
      typeof category === 'object' &&
      category !== null &&
      'name' in category &&
      category.name === name,
  )
  return readId(found)
}

export async function createSubcategory(
  client: TestClient,
  parentId: string,
  name: string,
  kind: EditableCategoryKind = 'expense',
): Promise<string> {
  const response = await client.post('/categories', {
    kind,
    name,
    parentId,
    expenseGroup: null,
  })
  expect(response.status).toBe(201)
  return readId(response.body)
}

export function operationBody(
  accountId: string,
  overrides: Partial<CreateOperationRequest> = {},
): CreateOperationRequest {
  return {
    accountId,
    paymentMethodId: null,
    date: '2026-11-05',
    amountCents: -4_500,
    label: 'Courses',
    note: null,
    categoryId: null,
    tagIds: [],
    ...overrides,
  }
}

export async function createOperation(
  client: TestClient,
  accountId: string,
  overrides: Partial<CreateOperationRequest> = {},
): Promise<string> {
  const response = await client.post(
    '/operations',
    operationBody(accountId, overrides),
  )
  expect(response.status).toBe(201)
  return readId(response.body)
}

export function transferBody(
  sourceAccountId: string,
  targetAccountId: string,
  overrides: Partial<CreateTransferRequest> = {},
): CreateTransferRequest {
  return {
    sourceAccountId,
    targetAccountId,
    date: '2026-11-06',
    amountCents: 10_000,
    label: 'Epargne',
    note: null,
    tagIds: [],
    ...overrides,
  }
}

export function expenseScheduleBody(
  accountId: string | null,
  expenseCategoryId: string,
  overrides: Partial<ExpenseScheduleRequest> = {},
): ExpenseScheduleRequest {
  return {
    kind: 'expense',
    label: 'Loyer',
    amountCents: 60_000,
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
    categoryId: expenseCategoryId,
    isSubscription: false,
    ...overrides,
  }
}

export async function createSchedule(
  client: TestClient,
  body: object,
): Promise<string> {
  const response = await client.post('/schedules', body)
  expect(response.status).toBe(201)
  return readId(response.body)
}

export function envelopeBody(
  accountId: string,
  categoryIds: string[],
  overrides: Partial<CreateEnvelopeRequest> = {},
): CreateEnvelopeRequest {
  return {
    label: 'Courses',
    monthlyAmountCents: 30_000,
    accountId,
    paymentMethodId: null,
    carryOver: false,
    active: true,
    categoryIds,
    ...overrides,
  }
}

export { readId }
