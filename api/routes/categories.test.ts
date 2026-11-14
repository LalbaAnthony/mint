import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { categoryListResponseSchema } from '@mint/shared/schemas/categories'
import type { Category } from '@mint/shared/types/categories'
import {
  createClient,
  createTestContext,
  createTestUser,
} from '../tests/context.js'
import type { TestClient, TestContext } from '../types/tests.js'
import { defaultCategories } from '../users/default-categories.js'

let context: TestContext
let counter = 0

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

afterAll(async () => {
  await context.close()
})

async function loggedInClient(locale: 'fr' | 'en' = 'fr'): Promise<TestClient> {
  counter += 1
  const user = await createTestUser(context, {
    email: `categories-${counter}@example.org`,
    locale,
  })
  const client = createClient(context.server)
  await client.login(user.email)
  return client
}

async function list(client: TestClient): Promise<Category[]> {
  return categoryListResponseSchema.parse(
    (await client.get('/categories')).body,
  )
}

async function byName(client: TestClient, name: string): Promise<Category> {
  const category = (await list(client)).find(
    (candidate) => candidate.name === name,
  )
  if (category === undefined) {
    throw new Error(`Category ${name} is missing`)
  }
  return category
}

async function createSubcategory(
  client: TestClient,
  parent: Category,
  name: string,
): Promise<Category> {
  const response = await client.post('/categories', {
    kind: parent.kind,
    name,
    parentId: parent.id,
    expenseGroup: null,
  })
  expect(response.status).toBe(201)
  return response.body
}

function namesOf(
  categories: Category[],
  filter: (category: Category) => boolean,
) {
  return categories.filter(filter).map((category) => category.name)
}

describe('GET /api/v1/categories (CAT-01 to CAT-05, CAT-08)', () => {
  it('lists the default set and the system categories in the user locale', async () => {
    const client = await loggedInClient('en')

    const categories = await list(client)

    expect(namesOf(categories, (category) => !category.isSystem)).toEqual(
      defaultCategories.map((category) => category.names.en),
    )
    expect(
      categories
        .filter((category) => category.isSystem)
        .map((category) => [category.kind, category.name, category.parentId]),
    ).toEqual([
      ['income', 'Interest', null],
      ['adjustment', 'Adjustment', null],
    ])
    expect(
      namesOf(categories, (category) => category.expenseGroup === 'needs'),
    ).toEqual([
      'Housing',
      'Groceries',
      'Food',
      'Transport',
      'Health',
      'Energy and telecoms',
      'Insurance',
    ])
  })

  it('gives subcategories the group of their parent (CAT-02)', async () => {
    const client = await loggedInClient()
    const housing = await byName(client, 'Logement')

    const rent = await createSubcategory(client, housing, 'Loyer')

    expect(rent).toEqual(
      expect.objectContaining({
        parentId: housing.id,
        kind: 'expense',
        expenseGroup: 'needs',
        sortOrder: 0,
      }),
    )
    expect((await byName(client, 'Loyer')).expenseGroup).toBe('needs')
  })
})

describe('POST /api/v1/categories', () => {
  it('creates a first-level expense category last in its group', async () => {
    const client = await loggedInClient()

    const response = await client.post('/categories', {
      kind: 'expense',
      name: 'Animaux',
      parentId: null,
      expenseGroup: 'needs',
    })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      id: expect.any(String),
      parentId: null,
      kind: 'expense',
      expenseGroup: 'needs',
      name: 'Animaux',
      isSystem: false,
      sortOrder: 7,
      archivedAt: null,
    })
  })

  it.each([
    [{ kind: 'expense', parentId: null, expenseGroup: null }, 'group_required'],
    [
      { kind: 'income', parentId: null, expenseGroup: 'wants' },
      'group_not_allowed',
    ],
  ])('rejects %j', async (overrides, message) => {
    const client = await loggedInClient()

    const response = await client.post('/categories', {
      name: 'Divers',
      ...overrides,
    })

    expect(response.status).toBe(400)
    expect(response.body.issues).toEqual([{ path: ['expenseGroup'], message }])
  })

  it('refuses the adjustment kind', async () => {
    const client = await loggedInClient()

    const response = await client.post('/categories', {
      kind: 'adjustment',
      name: 'Correction',
      parentId: null,
      expenseGroup: null,
    })

    expect(response.status).toBe(400)
    expect(response.body.issues).toEqual([
      { path: ['kind'], message: 'invalid' },
    ])
  })

  it('refuses a name already used at the same level', async () => {
    const client = await loggedInClient()

    const response = await client.post('/categories', {
      kind: 'income',
      name: 'Salaire',
      parentId: null,
      expenseGroup: null,
    })

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'category_name_taken' })
  })

  it('refuses a third level, a parent of another kind, a system parent and an archived parent', async () => {
    const client = await loggedInClient()
    const housing = await byName(client, 'Logement')
    const rent = await createSubcategory(client, housing, 'Loyer')
    const interest = await byName(client, 'Intérêts')
    const leisure = await byName(client, 'Loisirs')
    await client.post(`/categories/${leisure.id}/archive`)

    const attempts = await Promise.all([
      client.post('/categories', {
        kind: 'expense',
        name: 'Charges',
        parentId: rent.id,
        expenseGroup: null,
      }),
      client.post('/categories', {
        kind: 'income',
        name: 'Loyer perçu',
        parentId: housing.id,
        expenseGroup: null,
      }),
      client.post('/categories', {
        kind: 'income',
        name: 'Livret A',
        parentId: interest.id,
        expenseGroup: null,
      }),
      client.post('/categories', {
        kind: 'expense',
        name: 'Cinéma',
        parentId: leisure.id,
        expenseGroup: null,
      }),
    ])

    expect(attempts.map((response) => response.body)).toEqual([
      { error: 'invalid_parent' },
      { error: 'invalid_parent' },
      { error: 'invalid_parent' },
      { error: 'parent_archived' },
    ])
  })
})

describe('PATCH /api/v1/categories/:id', () => {
  it('renames a category and moves a first-level expense category to the other group', async () => {
    const client = await loggedInClient()
    const sport = await byName(client, 'Sport')

    const response = await client.patch(`/categories/${sport.id}`, {
      name: 'Sport et bien-être',
      expenseGroup: 'needs',
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(
      expect.objectContaining({
        name: 'Sport et bien-être',
        expenseGroup: 'needs',
        sortOrder: 7,
      }),
    )
  })

  it('moves a subcategory to another parent of the same kind, last there', async () => {
    const client = await loggedInClient()
    const housing = await byName(client, 'Logement')
    const energy = await byName(client, 'Énergie et télécoms')
    await createSubcategory(client, energy, 'Électricité')
    const internet = await createSubcategory(client, housing, 'Internet')

    const response = await client.patch(`/categories/${internet.id}`, {
      parentId: energy.id,
    })
    const toIncome = await client.patch(`/categories/${internet.id}`, {
      parentId: (await byName(client, 'Salaire')).id,
    })

    expect(response.status).toBe(200)
    expect(response.body).toEqual(
      expect.objectContaining({ parentId: energy.id, sortOrder: 1 }),
    )
    expect(toIncome.status).toBe(409)
    expect(toIncome.body).toEqual({ error: 'invalid_parent' })
  })

  it('refuses a level change and a group on a subcategory or an income category', async () => {
    const client = await loggedInClient()
    const housing = await byName(client, 'Logement')
    const salary = await byName(client, 'Salaire')
    const rent = await createSubcategory(client, housing, 'Loyer')

    const promote = await client.patch(`/categories/${housing.id}`, {
      parentId: salary.id,
    })
    const subGroup = await client.patch(`/categories/${rent.id}`, {
      expenseGroup: 'wants',
    })
    const incomeGroup = await client.patch(`/categories/${salary.id}`, {
      expenseGroup: 'needs',
    })

    expect(promote.body.issues).toEqual([
      { path: ['parentId'], message: 'parent_not_allowed' },
    ])
    expect(subGroup.body.issues).toEqual([
      { path: ['expenseGroup'], message: 'group_not_allowed' },
    ])
    expect(incomeGroup.body.issues).toEqual([
      { path: ['expenseGroup'], message: 'group_not_allowed' },
    ])
  })

  it('keeps system categories read-only (CAT-08)', async () => {
    const client = await loggedInClient()
    const adjustment = await byName(client, 'Ajustement')
    const interest = await byName(client, 'Intérêts')

    const responses = await Promise.all([
      client.patch(`/categories/${adjustment.id}`, { name: 'Correction' }),
      client.post(`/categories/${interest.id}/archive`),
      client.post(`/categories/${interest.id}/restore`),
      client.delete(`/categories/${adjustment.id}`),
    ])

    expect(responses.map((response) => response.status)).toEqual([
      409, 409, 409, 409,
    ])
    expect(responses.map((response) => response.body.error)).toEqual([
      'system_category',
      'system_category',
      'system_category',
      'system_category',
    ])
    expect((await byName(client, 'Ajustement')).id).toBe(adjustment.id)
  })
})

describe('archive, restore and delete with subcategories', () => {
  it('archives a parent with its active subcategories and restores it alone', async () => {
    const client = await loggedInClient()
    const housing = await byName(client, 'Logement')
    const rent = await createSubcategory(client, housing, 'Loyer')
    const works = await createSubcategory(client, housing, 'Travaux')
    context.clock.set(new Date('2026-11-10T10:00:00Z'))
    await client.post(`/categories/${works.id}/archive`)
    context.clock.set(new Date('2026-11-11T10:00:00Z'))

    const archived = await client.post(`/categories/${housing.id}/archive`)
    const blockedChild = await client.post(`/categories/${rent.id}/restore`)
    const restored = await client.post(`/categories/${housing.id}/restore`)

    expect(archived.body.archivedAt).toBe('2026-11-11T10:00:00.000Z')
    expect(blockedChild.body).toEqual({ error: 'parent_archived' })
    expect(restored.body.archivedAt).toBeNull()
    const categories = await list(client)
    expect(
      categories
        .filter((category) => category.parentId === housing.id)
        .map((category) => [category.name, category.archivedAt]),
    ).toEqual([
      ['Loyer', '2026-11-11T10:00:00.000Z'],
      ['Travaux', '2026-11-10T10:00:00.000Z'],
    ])
    expect((await client.post(`/categories/${rent.id}/restore`)).status).toBe(
      200,
    )
    expect(
      (await client.patch(`/categories/${works.id}`, { name: 'Bricolage' }))
        .body,
    ).toEqual({ error: 'archived' })
  })

  it('deletes a parent with its subcategories', async () => {
    const client = await loggedInClient()
    const leisure = await byName(client, 'Loisirs')
    await createSubcategory(client, leisure, 'Cinéma')
    await createSubcategory(client, leisure, 'Concerts')

    const response = await client.delete(`/categories/${leisure.id}`)

    expect(response.status).toBe(204)
    expect(
      namesOf(await list(client), (category) =>
        ['Loisirs', 'Cinéma', 'Concerts'].includes(category.name),
      ),
    ).toEqual([])
  })
})

describe('POST /api/v1/categories/reorder', () => {
  it('orders the first-level categories of one group', async () => {
    const client = await loggedInClient()
    const wants = (await list(client)).filter(
      (category) =>
        category.parentId === null && category.expenseGroup === 'wants',
    )
    const reversed = wants.map((category) => category.id).reverse()

    const response = await client.post('/categories/reorder', {
      categoryIds: reversed,
    })

    expect(response.status).toBe(204)
    expect(
      namesOf(
        await list(client),
        (category) =>
          category.parentId === null && category.expenseGroup === 'wants',
      ),
    ).toEqual([
      'Voyages',
      'Services numériques',
      'Sport',
      'Shopping',
      'Restaurants',
      'Loisirs',
    ])
  })

  it('orders the subcategories of one parent', async () => {
    const client = await loggedInClient()
    const housing = await byName(client, 'Logement')
    const rent = await createSubcategory(client, housing, 'Loyer')
    const works = await createSubcategory(client, housing, 'Travaux')

    await client.post('/categories/reorder', {
      categoryIds: [works.id, rent.id],
    })

    expect(
      namesOf(
        await list(client),
        (category) => category.parentId === housing.id,
      ),
    ).toEqual(['Travaux', 'Loyer'])
  })

  it('refuses categories that are not exactly one set of siblings', async () => {
    const client = await loggedInClient()
    const categories = await list(client)
    const needs = categories
      .filter((category) => category.expenseGroup === 'needs')
      .map((category) => category.id)
    const wants = categories
      .filter((category) => category.expenseGroup === 'wants')
      .map((category) => category.id)
    const interest = await byName(client, 'Intérêts')
    const incomes = categories
      .filter((category) => category.kind === 'income')
      .map((category) => category.id)

    const responses = await Promise.all([
      client.post('/categories/reorder', { categoryIds: needs.slice(1) }),
      client.post('/categories/reorder', {
        categoryIds: [...needs, ...wants],
      }),
      client.post('/categories/reorder', { categoryIds: incomes }),
      client.post('/categories/reorder', {
        categoryIds: [interest.id],
      }),
    ])

    expect(responses.map((response) => response.body)).toEqual([
      { error: 'order_mismatch' },
      { error: 'order_mismatch' },
      { error: 'order_mismatch' },
      { error: 'order_mismatch' },
    ])
  })
})
