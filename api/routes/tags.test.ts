import iconv from 'iconv-lite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { importBatchViewSchema } from '@mint/shared/schemas/imports'
import {
  operationListResponseSchema,
  operationSchema,
  transferSchema,
} from '@mint/shared/schemas/operations'
import { ruleSchema } from '@mint/shared/schemas/rules'
import { scheduleSchema } from '@mint/shared/schemas/schedules'
import { tagListResponseSchema, tagSchema } from '@mint/shared/schemas/tags'
import type { CsvMapping } from '@mint/shared/types/imports'
import { executeDueOccurrences } from '../execution/execute.js'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createSavingsAccount,
  expenseScheduleBody,
  operationBody,
  signedInClient,
  transferBody,
} from '../tests/fixtures.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

beforeEach(() => {
  context.clock.set(new Date('2026-11-11T10:00:00Z'))
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'tags')
}

async function createTag(user: TestClient, name: string): Promise<string> {
  const response = await user.post('/tags', { name })
  expect(response.status).toBe(201)
  return tagSchema.parse(response.body).id
}

async function tags(user: TestClient) {
  return tagListResponseSchema.parse((await user.get('/tags')).body)
}

async function operations(user: TestClient, query = '') {
  return operationListResponseSchema.parse(
    (await user.get(`/operations${query}`)).body,
  ).items
}

async function createOperation(user: TestClient, body: object) {
  const response = await user.post('/operations', body)
  expect(response.status).toBe(201)
  return operationSchema.parse(response.body)
}

const mapping: CsvMapping = {
  delimiter: 'semicolon',
  encoding: 'windows-1252',
  hasHeader: true,
  skipTop: 0,
  skipBottom: 0,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: 'comma',
  colDate: 0,
  colLabel: 1,
  colAmount: 2,
  colDebit: null,
  colCredit: null,
}

async function importLines(
  user: TestClient,
  accountId: string,
  lines: string[],
  decisions: object[] = [],
) {
  const uploaded = await user.upload(
    `/accounts/${accountId}/imports?filename=releve.csv`,
    iconv.encode(['Date;Libelle;Montant', ...lines].join('\r\n'), 'utf-8'),
  )
  expect(uploaded.status).toBe(201)
  const batchId = importBatchViewSchema.parse(uploaded.body).batch.id
  const previewed = await user.post(`/imports/${batchId}/preview`, {
    mapping: { ...mapping, encoding: 'utf-8' },
  })
  expect(previewed.status).toBe(200)
  const view = importBatchViewSchema.parse(previewed.body)
  const validated = await user.post(`/imports/${batchId}/validate`, {
    mapping: { ...mapping, encoding: 'utf-8' },
    decisions,
  })
  expect(validated.status).toBe(200)
  return { batchId, view }
}

describe('CAT-09 tags', () => {
  it('creates a tag once whatever the case of its name, renames it and refuses a name already taken', async () => {
    const user = await client()

    const created = await user.post('/tags', { name: '  Vacances ' })
    const again = await user.post('/tags', { name: 'vacances' })
    const other = await createTag(user, 'Travaux')

    expect(created.status).toBe(201)
    expect(created.body).toEqual({
      id: expect.any(String),
      name: 'Vacances',
      operationCount: 0,
      scheduleCount: 0,
      ruleCount: 0,
    })
    expect(again.status).toBe(200)
    expect(again.body.id).toBe(created.body.id)

    const renamed = await user.patch(`/tags/${created.body.id}`, {
      name: 'Congés',
    })
    expect(renamed.status).toBe(200)
    expect(renamed.body.name).toBe('Congés')

    const taken = await user.patch(`/tags/${other}`, { name: 'CONGÉS' })
    expect(taken.status).toBe(409)
    expect(taken.body).toEqual({ error: 'tag_name_taken' })
    expect((await tags(user)).map((tag) => tag.name)).toEqual([
      'Congés',
      'Travaux',
    ])
  })

  it('tags operations and transfers, counts a transfer once and filters the operations by any of the selected tags (OPE-05)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)
    const holidays = await createTag(user, 'Vacances')
    const works = await createTag(user, 'Travaux')
    const unused = await createTag(user, 'Inutile')

    const hotel = await createOperation(
      user,
      operationBody(accountId, {
        label: 'Hôtel',
        tagIds: [holidays, holidays],
      }),
    )
    const paint = await createOperation(
      user,
      operationBody(accountId, { label: 'Peinture', tagIds: [works] }),
    )
    await createOperation(user, operationBody(accountId, { label: 'Pain' }))
    const transfer = await user.post(
      '/transfers',
      transferBody(accountId, savingsId, { tagIds: [holidays] }),
    )
    expect(transfer.status).toBe(201)
    const movements = transferSchema.parse(transfer.body)

    expect(hotel.tagIds).toEqual([holidays])
    expect(paint.tagIds).toEqual([works])
    expect(movements.source.tagIds).toEqual([holidays])
    expect(movements.target.tagIds).toEqual([holidays])
    expect(
      (await tags(user)).map((tag) => [tag.name, tag.operationCount]),
    ).toEqual([
      ['Inutile', 0],
      ['Travaux', 1],
      ['Vacances', 2],
    ])
    expect(
      (await operations(user, `?tagIds=${holidays}&tagIds=${works}`))
        .map((operation) => operation.label)
        .sort(),
    ).toEqual(['Epargne', 'Epargne', 'Hôtel', 'Peinture'])
    expect(await operations(user, `?tagIds=${unused}`)).toEqual([])
  })

  it('keeps the tags of an operation when a modification omits them and replaces them when given', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const holidays = await createTag(user, 'Vacances')
    const works = await createTag(user, 'Travaux')
    const operation = await createOperation(
      user,
      operationBody(accountId, { tagIds: [holidays] }),
    )

    const relabelled = await user.patch(`/operations/${operation.id}`, {
      label: 'Marché',
    })
    const retagged = await user.patch(`/operations/${operation.id}`, {
      tagIds: [works],
    })

    expect(relabelled.body.tagIds).toEqual([holidays])
    expect(retagged.body.tagIds).toEqual([works])
  })

  it('refuses more than 20 tags on an item', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const ids = await Promise.all(
      Array.from({ length: 21 }, (_, index) => createTag(user, `Tag ${index}`)),
    )

    const response = await user.post(
      '/operations',
      operationBody(accountId, { tagIds: ids }),
    )

    expect(response.status).toBe(400)
    expect(response.body.issues).toEqual([
      { path: ['tagIds'], message: 'too_many_tags' },
    ])
  })

  it('copies the tags of a schedule to the operations it generates (EXE-01)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const housing = await categoryId(user, 'Logement')
    const home = await createTag(user, 'Maison')
    const created = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, housing, {
        startDate: '2026-11-20',
        tagIds: [home],
      }),
    )
    expect(created.status).toBe(201)
    expect(scheduleSchema.parse(created.body).tagIds).toEqual([home])

    await executeDueOccurrences(
      {
        sequelize: context.dependencies.sequelize,
        models: context.dependencies.models,
      },
      '2026-11-20',
    )

    const [generated] = await operations(user, '?origins=schedule')
    expect(generated?.tagIds).toEqual([home])
    expect((await tags(user))[0]).toEqual(
      expect.objectContaining({ operationCount: 1, scheduleCount: 1 }),
    )
  })

  it('applies the tags of the matching rule to imported lines and merges them with those of a generated operation (IMP-06, RAP-03), then restores them on cancellation (IMP-08)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const digital = await categoryId(user, 'Services numériques')
    const subscription = await createTag(user, 'Abonnement')
    const family = await createTag(user, 'Famille')
    const rule = await user.post('/rules', {
      matchType: 'contains',
      pattern: 'DEEZER',
      accountId: null,
      sign: 'debit',
      amountMinCents: null,
      amountMaxCents: null,
      categoryId: digital,
      transferAccountId: null,
      tagIds: [subscription],
      active: true,
    })
    expect(rule.status).toBe(201)
    expect(ruleSchema.parse(rule.body).tagIds).toEqual([subscription])
    const scheduled = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, digital, {
        label: 'Deezer',
        amountCents: 1_199,
        startDate: '2026-12-05',
        tagIds: [family],
      }),
    )
    expect(scheduled.status).toBe(201)
    await executeDueOccurrences(
      {
        sequelize: context.dependencies.sequelize,
        models: context.dependencies.models,
      },
      '2026-12-05',
    )
    context.clock.set(new Date('2026-12-08T10:00:00Z'))

    const { batchId, view } = await importLines(user, accountId, [
      '06/12/2026;PRLV SEPA DEEZER;-11,99',
      '07/12/2026;DEEZER FAMILY;-5,00',
    ])

    expect(view.rows.map((row) => row.tagIds)).toEqual([
      [subscription],
      [subscription],
    ])
    expect(
      (await operations(user)).map((operation) => [
        operation.label,
        operation.origin,
        operation.tagIds,
      ]),
    ).toEqual([
      ['DEEZER FAMILY', 'import', [subscription]],
      ['Deezer', 'import', [subscription, family].sort()],
    ])

    const cancelled = await user.post(`/imports/${batchId}/cancel`)
    expect(cancelled.status).toBe(200)
    expect(
      (await operations(user)).map((operation) => [
        operation.label,
        operation.origin,
        operation.tagIds,
      ]),
    ).toEqual([['Deezer', 'schedule', [family]]])
  })

  it('merges the tags of an operation with those of the generated operation it replaces (RAP-05)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const housing = await categoryId(user, 'Logement')
    const home = await createTag(user, 'Maison')
    const paid = await createTag(user, 'Payé')
    const schedule = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, housing, {
        startDate: '2026-12-05',
        tagIds: [home],
      }),
    )
    expect(schedule.status).toBe(201)
    await executeDueOccurrences(
      {
        sequelize: context.dependencies.sequelize,
        models: context.dependencies.models,
      },
      '2026-12-05',
    )
    context.clock.set(new Date('2026-12-08T10:00:00Z'))
    const manual = await createOperation(
      user,
      operationBody(accountId, {
        date: '2026-12-05',
        amountCents: -60_000,
        label: 'Loyer',
        categoryId: housing,
        tagIds: [paid],
      }),
    )

    const reconciled = await user.post(`/operations/${manual.id}/reconcile`, {
      scheduleId: schedule.body.id,
      originalDate: '2026-12-05',
    })

    expect(reconciled.status).toBe(200)
    expect(reconciled.body.tagIds).toEqual([home, paid].sort())
    expect(await operations(user)).toHaveLength(1)
  })

  it('gives both movements of a converted transfer the tags of the two linked operations (OPE-07)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const savingsId = await createSavingsAccount(user)
    const holidays = await createTag(user, 'Vacances')
    const works = await createTag(user, 'Travaux')
    const debit = await createOperation(
      user,
      operationBody(accountId, {
        date: '2026-11-06',
        amountCents: -10_000,
        tagIds: [holidays],
      }),
    )
    await createOperation(
      user,
      operationBody(savingsId, {
        date: '2026-11-07',
        amountCents: 10_000,
        tagIds: [works],
      }),
    )

    const converted = await user.post(
      `/operations/${debit.id}/convert-to-transfer`,
      { counterpartAccountId: savingsId },
    )

    expect(converted.status).toBe(200)
    const transfer = transferSchema.parse(converted.body)
    expect(transfer.source.tagIds).toEqual([holidays, works].sort())
    expect(transfer.target.tagIds).toEqual([holidays, works].sort())
  })

  it('removes a deleted tag from operations, schedules and rules', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const housing = await categoryId(user, 'Logement')
    const home = await createTag(user, 'Maison')
    const kept = await createTag(user, 'Gardé')
    const operation = await createOperation(
      user,
      operationBody(accountId, { tagIds: [home, kept] }),
    )
    const schedule = await user.post(
      '/schedules',
      expenseScheduleBody(accountId, housing, { tagIds: [home] }),
    )
    const rule = await user.post('/rules', {
      matchType: 'contains',
      pattern: 'LOYER',
      accountId: null,
      sign: 'any',
      amountMinCents: null,
      amountMaxCents: null,
      categoryId: housing,
      transferAccountId: null,
      tagIds: [home, kept],
      active: true,
    })
    expect((await tags(user)).find((tag) => tag.id === home)).toEqual(
      expect.objectContaining({
        operationCount: 1,
        scheduleCount: 1,
        ruleCount: 1,
      }),
    )

    const deleted = await user.delete(`/tags/${home}`)

    expect(deleted.status).toBe(204)
    expect((await operations(user))[0]?.tagIds).toEqual([kept])
    expect(operation.tagIds).toHaveLength(2)
    const schedules = await user.get('/schedules')
    expect(schedules.body.schedules[0].id).toBe(schedule.body.id)
    expect(schedules.body.schedules[0].tagIds).toEqual([])
    const rules = await user.get('/rules')
    expect(rules.body[0].id).toBe(rule.body.id)
    expect(rules.body[0].tagIds).toEqual([kept])
    expect((await user.delete(`/tags/${home}`)).status).toBe(404)
  })
})
