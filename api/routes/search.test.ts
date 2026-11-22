import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { searchResponseSchema } from '@mint/shared/schemas/search'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createSavingsAccount,
  createSchedule,
  createSubcategory,
  envelopeBody,
  expenseScheduleBody,
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
  return signedInClient(context, 'search')
}

async function search(user: TestClient, query: string) {
  const response = await user.get(`/search?${query}`)
  expect(response.status).toBe(200)
  return searchResponseSchema.parse(response.body)
}

function idsOf(items: readonly { id: string }[]): string[] {
  return items.map((item) => item.id)
}

async function createEnvelope(user: TestClient, body: object) {
  const response = await user.post('/envelopes', body)
  expect(response.status).toBe(201)
  return readId(response.body)
}

async function createTag(user: TestClient, name: string) {
  const response = await user.post('/tags', { name })
  expect(response.status).toBe(201)
  return readId(response.body)
}

describe('RCH-02 and RCH-03 matching', () => {
  it('finds accounts, operations, schedules and envelopes by text, ignoring case and accents', async () => {
    const user = await client()
    const byName = await createAccount(user, { name: 'Compte SANTÉ' })
    const byInstitution = await createAccount(user, {
      name: 'Courant',
      institution: 'Mutuelle santé',
    })
    await createAccount(user, { name: 'Autre', institution: 'Banque' })
    const byLabel = await createOperation(user, byName, {
      label: 'Pharmacie Santé',
    })
    const byNote = await createOperation(user, byName, {
      label: 'Visite',
      note: 'Bilan de santé',
    })
    const byBankLabel = await createOperation(user, byName, {
      label: 'Carte',
    })
    await context.dependencies.models.Transaction.update(
      { bankLabel: 'CB SANTE 12/11' },
      { where: { id: byBankLabel } },
    )
    await createOperation(user, byName, { label: 'Boulangerie' })
    const housing = await categoryId(user, 'Logement')
    const scheduleByLabel = await createSchedule(
      user,
      expenseScheduleBody(byName, housing, { label: 'Mutuelle Santé' }),
    )
    const scheduleByNote = await createSchedule(
      user,
      expenseScheduleBody(byName, housing, {
        label: 'Assurance',
        note: 'Option santé',
      }),
    )
    await createSchedule(user, expenseScheduleBody(byName, housing))
    const envelope = await createEnvelope(
      user,
      envelopeBody(byName, [await categoryId(user, 'Loisirs')], {
        label: 'Budget santé',
      }),
    )

    const result = await search(user, 'q=sante')

    expect(idsOf(result.accounts)).toEqual([byName, byInstitution])
    expect(idsOf(result.operations.items).sort()).toEqual(
      [byLabel, byNote, byBankLabel].sort(),
    )
    expect(result.operations.total).toBe(3)
    expect(idsOf(result.schedules)).toEqual([scheduleByLabel, scheduleByNote])
    expect(result.envelopes.map((line) => line.envelope.id)).toEqual([envelope])
  })

  it('finds operations, schedules and envelopes through their category, its parent or their tags', async () => {
    const user = await client()
    const accountId = await createAccount(user, { name: 'Principal' })
    const groceries = await categoryId(user, 'Courses')
    const drive = await createSubcategory(user, groceries, 'Drive')
    const leisure = await categoryId(user, 'Loisirs')
    const holidays = await createTag(user, 'Vacances été')
    const inCategory = await createOperation(user, accountId, {
      label: 'Hypermarché',
      categoryId: groceries,
    })
    const inSubcategory = await createOperation(user, accountId, {
      label: 'Retrait',
      categoryId: drive,
    })
    const tagged = await createOperation(user, accountId, {
      label: 'Camping',
      categoryId: leisure,
      tagIds: [holidays],
    })
    const scheduleInSubcategory = await createSchedule(
      user,
      expenseScheduleBody(accountId, drive, { label: 'Panier' }),
    )
    const taggedSchedule = await createSchedule(user, {
      ...expenseScheduleBody(accountId, leisure, { label: 'Location' }),
      tagIds: [holidays],
    })
    const envelopeInSubcategory = await createEnvelope(
      user,
      envelopeBody(accountId, [drive], { label: 'Alimentation' }),
    )

    const byCategory = await search(user, 'q=COURSES')
    const byTag = await search(user, 'q=ete')

    expect(idsOf(byCategory.operations.items).sort()).toEqual(
      [inCategory, inSubcategory].sort(),
    )
    expect(idsOf(byCategory.schedules)).toEqual([scheduleInSubcategory])
    expect(byCategory.envelopes.map((line) => line.envelope.id)).toEqual([
      envelopeInSubcategory,
    ])
    expect(idsOf(byTag.operations.items)).toEqual([tagged])
    expect(idsOf(byTag.schedules)).toEqual([taggedSchedule])
    expect(byTag.envelopes).toEqual([])
    expect(byTag.accounts).toEqual([])
  })

  it('also finds the exact absolute amount when one is given, besides the text', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const debit = await createOperation(user, accountId, {
      label: 'Boulangerie',
      amountCents: -1_250,
    })
    const credit = await createOperation(user, accountId, {
      label: 'Remboursement',
      amountCents: 1_250,
    })
    const byText = await createOperation(user, accountId, {
      label: 'Ticket 12,50',
      amountCents: -300,
    })
    await createOperation(user, accountId, {
      label: 'Fromager',
      amountCents: -12_500,
    })
    const schedule = await createSchedule(
      user,
      expenseScheduleBody(accountId, await categoryId(user, 'Logement'), {
        label: 'Parking',
        amountCents: 1_250,
      }),
    )
    const envelope = await createEnvelope(
      user,
      envelopeBody(accountId, [await categoryId(user, 'Loisirs')], {
        label: 'Sorties',
        monthlyAmountCents: 1_250,
      }),
    )

    const withAmount = await search(user, 'q=12%2C50&amountCents=1250')
    const textOnly = await search(user, 'q=12%2C50')

    expect(idsOf(withAmount.operations.items).sort()).toEqual(
      [debit, credit, byText].sort(),
    )
    expect(idsOf(withAmount.schedules)).toEqual([schedule])
    expect(withAmount.envelopes.map((line) => line.envelope.id)).toEqual([
      envelope,
    ])
    expect(withAmount.accounts).toEqual([])
    expect(idsOf(textOnly.operations.items)).toEqual([byText])
    expect(textOnly.schedules).toEqual([])
    expect(textOnly.envelopes).toEqual([])
  })

  it('treats the LIKE wildcards of the text literally', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const percent = await createOperation(user, accountId, {
      label: 'Panier 100% bio',
    })
    await createOperation(user, accountId, { label: 'Pain 100 g' })

    expect(idsOf((await search(user, 'q=0%25')).operations.items)).toEqual([
      percent,
    ])
    expect((await search(user, 'q=__')).operations.total).toBe(0)
  })

  it('leaves out the system interest schedules', async () => {
    const user = await client()
    await createSavingsAccount(user)

    const result = await search(user, 'q=interets')

    expect(result.schedules).toEqual([])
  })
})

describe('RCH-04 and RCH-05 results', () => {
  it('keeps the order of the views with archived and inactive objects last, and the values of the views', async () => {
    const user = await client()
    const archived = await createAccount(user, { name: 'Maison ancienne' })
    const savings = await createSavingsAccount(user, 'Maison livret')
    const current = await createAccount(user, { name: 'Maison courant' })
    expect((await user.post(`/accounts/${archived}/archive`)).status).toBe(200)
    await createOperation(user, current, {
      label: 'Achat',
      amountCents: -4_500,
    })
    const housing = await categoryId(user, 'Logement')
    const inactiveSchedule = await createSchedule(
      user,
      expenseScheduleBody(current, housing, {
        label: 'Maison ancien loyer',
        active: false,
      }),
    )
    const activeSchedule = await createSchedule(
      user,
      expenseScheduleBody(current, housing, { label: 'Maison loyer' }),
    )
    const inactiveEnvelope = await createEnvelope(
      user,
      envelopeBody(current, [await categoryId(user, 'Loisirs')], {
        label: 'Maison déco',
        active: false,
      }),
    )
    const groceries = await categoryId(user, 'Courses')
    const activeEnvelope = await createEnvelope(
      user,
      envelopeBody(current, [groceries], { label: 'Maison courses' }),
    )
    await createOperation(user, current, {
      label: 'Supermarché',
      amountCents: -6_000,
      categoryId: groceries,
    })

    const result = await search(user, 'q=maison')

    expect(idsOf(result.accounts)).toEqual([current, savings, archived])
    expect(result.accounts[0]?.currentBalanceCents).toBe(89_500)
    expect(result.accounts[2]?.archivedAt).not.toBeNull()
    expect(idsOf(result.schedules)).toEqual([activeSchedule, inactiveSchedule])
    expect(result.schedules[0]).toMatchObject({
      monthlyEquivalentCents: 60_000,
      nextOccurrence: expect.objectContaining({ effectiveDate: '2026-12-01' }),
    })
    expect(result.envelopes).toEqual([
      {
        envelope: expect.objectContaining({ id: activeEnvelope }),
        status: expect.objectContaining({
          budgetCents: 30_000,
          consumedCents: 6_000,
          availableCents: 24_000,
        }),
      },
      {
        envelope: expect.objectContaining({ id: inactiveEnvelope }),
        status: null,
      },
    ])
  })

  it('returns the operations by date descending, in batches with their total', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const first = await createOperation(user, accountId, {
      label: 'Lot A',
      date: '2026-11-01',
    })
    const third = await createOperation(user, accountId, {
      label: 'Lot B',
      date: '2026-11-03',
    })
    const second = await createOperation(user, accountId, {
      label: 'Lot C',
      date: '2026-11-02',
    })

    const firstBatch = await search(user, 'q=lot&operationsLimit=2')
    const secondBatch = await search(
      user,
      'q=lot&operationsLimit=2&operationsOffset=2',
    )

    expect(idsOf(firstBatch.operations.items)).toEqual([third, second])
    expect(firstBatch.operations.total).toBe(3)
    expect(idsOf(secondBatch.operations.items)).toEqual([first])
    expect(secondBatch.operations.total).toBe(3)
  })

  it('refuses a text under 2 characters and a batch over 100 operations', async () => {
    const user = await client()

    const short = await user.get('/search?q=%20a%20')
    const large = await user.get('/search?q=ab&operationsLimit=101')

    expect(short.status).toBe(400)
    expect(short.body.issues).toEqual([
      { path: ['q'], message: 'search_too_short' },
    ])
    expect(large.status).toBe(400)
    expect(large.body.issues).toEqual([
      { path: ['operationsLimit'], message: 'invalid' },
    ])
  })
})
