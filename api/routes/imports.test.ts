import iconv from 'iconv-lite'
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import {
  importBatchSchema,
  importBatchViewSchema,
} from '@mint/shared/schemas/imports'
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import type { CsvMapping } from '@mint/shared/types/imports'
import { executeDueOccurrences } from '../execution/execute.js'
import { createTestContext } from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createSavingsAccount,
  createSchedule,
  expenseScheduleBody,
  signedInClient,
} from '../tests/fixtures.js'
import type { TestClient, TestContext } from '../types/tests.js'

let context: TestContext

beforeAll(async () => {
  context = await createTestContext({ now: new Date('2026-11-11T10:00:00Z') })
})

beforeEach(() => {
  context.clock.set(new Date('2026-11-11T10:00:00Z'))
  vi.restoreAllMocks()
})

afterAll(async () => {
  await context.close()
})

function client(): Promise<TestClient> {
  return signedInClient(context, 'imports')
}

const bankMapping: CsvMapping = {
  delimiter: 'semicolon',
  encoding: 'windows-1252',
  hasHeader: true,
  skipTop: 0,
  skipBottom: 0,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: 'comma',
  colDate: 0,
  colLabel: 1,
  colAmount: null,
  colDebit: 2,
  colCredit: 3,
}

function bankFile(lines: string[]): Buffer {
  return iconv.encode(
    ['Date;Libellé;Débit;Crédit', ...lines].join('\r\n'),
    'windows-1252',
  )
}

async function upload(
  user: TestClient,
  accountId: string,
  content: Buffer,
  filename = 'releve.csv',
) {
  const response = await user.upload(
    `/accounts/${accountId}/imports?filename=${filename}`,
    content,
  )
  expect(response.status).toBe(201)
  return importBatchViewSchema.parse(response.body)
}

async function preview(
  user: TestClient,
  batchId: string,
  mapping = bankMapping,
) {
  const response = await user.post(`/imports/${batchId}/preview`, { mapping })
  expect(response.status).toBe(200)
  return importBatchViewSchema.parse(response.body)
}

async function validate(
  user: TestClient,
  batchId: string,
  decisions: object[] = [],
  mapping = bankMapping,
) {
  const response = await user.post(`/imports/${batchId}/validate`, {
    mapping,
    decisions,
  })
  expect(response.status).toBe(200)
  return importBatchSchema.parse(response.body)
}

async function operations(user: TestClient, query = '') {
  return operationListResponseSchema.parse(
    (await user.get(`/operations${query}`)).body,
  ).items
}

function runWorker(today: string) {
  return executeDueOccurrences(
    {
      sequelize: context.dependencies.sequelize,
      models: context.dependencies.models,
    },
    today,
  )
}

describe('US-17 import a bank CSV once configured (IMP-01 to IMP-05, IMP-08)', () => {
  it('reads a Windows-1252 file with debit and credit columns, remembers the settings and excludes the duplicates of a reimport', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const first = bankFile([
      '05/11/2026;CB Crêperie;12,50;',
      '06/11/2026;VIR SALAIRE;;1 500,00',
      '06/11/2026;CB Crêperie;12,50;',
    ])

    const pending = await upload(user, accountId, first)
    expect(pending.mappingRemembered).toBe(false)
    expect(pending.mapping.encoding).toBe('windows-1252')
    expect(pending.sampleLines[1]).toEqual([
      '05/11/2026',
      'CB Crêperie',
      '12,50',
      '',
    ])

    const previewed = await preview(user, pending.batch.id)
    expect(
      previewed.rows.map((row) => [
        row.date,
        row.amountCents,
        row.bankLabel,
        row.duplicate,
      ]),
    ).toEqual([
      ['2026-11-05', -1_250, 'CB Crêperie', false],
      ['2026-11-06', 150_000, 'VIR SALAIRE', false],
      ['2026-11-06', -1_250, 'CB Crêperie', false],
    ])
    const validated = await validate(user, pending.batch.id)
    expect(validated).toMatchObject({
      status: 'validated',
      rowsRead: 3,
      rowsCreated: 3,
      rowsDuplicate: 0,
      rowsMerged: 0,
    })
    expect(await operations(user)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'VIR SALAIRE',
          bankLabel: 'VIR SALAIRE',
          origin: 'import',
          status: 'to_categorize',
        }),
      ]),
    )

    const second = await upload(
      user,
      accountId,
      bankFile(['10/11/2026;PRLV EDF;45,00;']),
    )
    expect(second.mappingRemembered).toBe(true)
    expect(second.mapping).toEqual(bankMapping)

    const again = await upload(user, accountId, first)
    const duplicates = await preview(user, again.batch.id)
    expect(duplicates.rows.every((row) => row.duplicate)).toBe(true)
    const repeated = await validate(user, again.batch.id)
    expect(repeated).toMatchObject({ rowsCreated: 0, rowsDuplicate: 3 })
    expect(await operations(user)).toHaveLength(3)

    const history = await user.get(`/accounts/${accountId}/imports`)
    expect(
      history.body.batches.map((batch: { status: string }) => batch.status),
    ).toEqual(['validated', 'pending', 'validated'])
  })

  it('lists the lines in error with their reason and refuses lines before the initial balance (IMP-04)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const pending = await upload(
      user,
      accountId,
      bankFile([
        '31/10/2026;CB AVANT;1,00;',
        '32/11/2026;CB DATE;1,00;',
        '05/11/2026;CB DEUX;1,00;2,00',
        '05/11/2026;CB OK;1,00;',
      ]),
    )

    const previewed = await preview(user, pending.batch.id)

    expect(previewed.rows.map((row) => row.error)).toEqual([
      'date_before_initial_balance',
      'invalid_date',
      'both_amounts',
      null,
    ])
    expect((await validate(user, pending.batch.id)).rowsCreated).toBe(1)
  })

  it('cancels an import, abandons a pending one and refuses to validate twice', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const pending = await upload(
      user,
      accountId,
      bankFile(['05/11/2026;CB X;1,00;']),
    )
    await preview(user, pending.batch.id)
    await validate(user, pending.batch.id)

    const twice = await user.post(`/imports/${pending.batch.id}/validate`, {
      mapping: bankMapping,
      decisions: [],
    })
    expect(twice.body).toEqual({ error: 'import_not_pending' })
    const cancelled = await user.post(`/imports/${pending.batch.id}/cancel`)
    expect(cancelled.body).toMatchObject({ status: 'cancelled' })
    expect(await operations(user)).toEqual([])

    const other = await upload(
      user,
      accountId,
      bankFile(['05/11/2026;CB Y;1,00;']),
    )
    expect(
      (
        await user.post(`/imports/${other.batch.id}/validate`, {
          mapping: bankMapping,
          decisions: [],
        })
      ).body,
    ).toEqual({ error: 'import_not_previewed' })
    expect((await user.delete(`/imports/${other.batch.id}`)).status).toBe(204)
    expect((await user.get(`/imports/${other.batch.id}`)).status).toBe(404)
  })

  it('refuses an empty file and a file larger than 5 MB', async () => {
    const user = await client()
    const accountId = await createAccount(user)

    const empty = await user.upload(
      `/accounts/${accountId}/imports?filename=vide.csv`,
      Buffer.alloc(0),
    )
    const large = await user.upload(
      `/accounts/${accountId}/imports?filename=gros.csv`,
      Buffer.alloc(5 * 1024 * 1024 + 1, 'a'),
    )

    expect(empty.status).toBe(400)
    expect(large.status).toBe(413)
  })
})

describe('US-18 categorize automatically (REG-01, REG-04, IMP-06)', () => {
  it('classifies a known bank label and leaves an unknown one to categorize', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const digital = await categoryId(user, 'Services numériques')
    await user.post('/rules', {
      matchType: 'contains',
      pattern: 'DEEZER',
      accountId: null,
      sign: 'any',
      amountMinCents: null,
      amountMaxCents: null,
      categoryId: digital,
      transferAccountId: null,
      active: true,
    })
    const pending = await upload(
      user,
      accountId,
      bankFile([
        '06/11/2026;PRLV SEPA DEEZER 06/12;11,99;',
        '07/11/2026;CB BOULANGERIE;4,50;',
      ]),
    )

    const previewed = await preview(user, pending.batch.id)
    expect(previewed.rows.map((row) => row.categoryId)).toEqual([digital, null])
    await validate(user, pending.batch.id)

    const items = await operations(user)
    expect(
      items.find((item) => item.label === 'PRLV SEPA DEEZER 06/12'),
    ).toMatchObject({
      categoryId: digital,
      status: 'categorized',
    })
    expect(items.find((item) => item.label === 'CB BOULANGERIE')).toMatchObject(
      {
        categoryId: null,
        status: 'to_categorize',
      },
    )
  })

  it('converts a line into a transfer when a rule says so, creating the counterpart', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const savings = await createSavingsAccount(user)
    await user.post('/rules', {
      matchType: 'starts_with',
      pattern: 'VIR EPARGNE',
      accountId: null,
      sign: 'debit',
      amountMinCents: null,
      amountMaxCents: null,
      categoryId: null,
      transferAccountId: savings,
      active: true,
    })
    const pending = await upload(
      user,
      checking,
      bankFile(['06/11/2026;VIR EPARGNE LIVRET;100,00;']),
    )
    await preview(user, pending.batch.id)
    await validate(user, pending.batch.id)

    const items = await operations(user)
    expect(items).toHaveLength(2)
    expect(items.map((item) => item.counterpartAccountId).sort()).toEqual(
      [checking, savings].sort(),
    )
  })
})

describe('US-09 executed occurrence then corrected by the import (EXE-01, RAP-03, IMP-08)', () => {
  it('proposes the occurrence, lets the bank value win on validation and restores it on cancel', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Salaire')),
      kind: 'income',
      isSubscription: undefined,
      label: 'Prestation',
      amountCents: 20_000,
      startDate: '2026-12-05',
    })
    await runWorker('2026-12-05')
    context.clock.set(new Date('2026-12-08T10:00:00Z'))
    expect(await operations(user)).toEqual([
      expect.objectContaining({
        amountCents: 20_000,
        date: '2026-12-05',
        origin: 'schedule',
      }),
    ])

    const pending = await upload(
      user,
      accountId,
      bankFile(['07/12/2026;VIR PRESTATION;;187,00']),
    )
    const previewed = await preview(user, pending.batch.id)
    expect(previewed.rows[0]?.candidates[0]).toMatchObject({
      scheduleId,
      originalDate: '2026-12-05',
      amountCents: 20_000,
    })

    const validated = await validate(user, pending.batch.id)
    expect(validated).toMatchObject({ rowsMerged: 1, rowsCreated: 0 })
    const merged = await operations(user)
    expect(merged).toEqual([
      expect.objectContaining({
        amountCents: 18_700,
        date: '2026-12-07',
        origin: 'import',
        bankLabel: 'VIR PRESTATION',
        reconciled: true,
        scheduleId,
      }),
    ])
    const schedules = await user.get('/schedules')
    expect(schedules.body.schedules[0].bankLabelPatterns).toEqual([
      'VIR PRESTATION',
    ])

    await user.post(`/imports/${pending.batch.id}/cancel`)
    expect(await operations(user)).toEqual([
      expect.objectContaining({
        amountCents: 20_000,
        date: '2026-12-05',
        origin: 'schedule',
        bankLabel: null,
      }),
    ])
  })

  it('marks a future occurrence executed when the bank line comes early, and plans it again on cancel (RAP-04)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement'), {
        label: 'Loyer',
      }),
      amountCents: 60_000,
      startDate: '2026-11-15',
    })
    const pending = await upload(
      user,
      accountId,
      bankFile(['12/11/2026;PRLV LOYER;600,00;']),
    )
    await preview(user, pending.batch.id)

    await validate(user, pending.batch.id)

    const occurrences = await user.get(
      `/schedules/${(await user.get('/schedules')).body.schedules[0].id}/occurrences`,
    )
    expect(occurrences.body.occurrences[0]).toMatchObject({
      originalDate: '2026-11-15',
      status: 'executed',
    })
    expect(await operations(user)).toEqual([
      expect.objectContaining({
        label: 'Loyer',
        reconciled: true,
        amountCents: -60_000,
      }),
    ])

    await user.post(`/imports/${pending.batch.id}/cancel`)
    const restored = await user.get(
      `/schedules/${(await user.get('/schedules')).body.schedules[0].id}/occurrences`,
    )
    expect(restored.body.occurrences[0]).toMatchObject({ status: 'pending' })
  })

  it('creates the line without reconciliation when the user refuses the proposal (RAP-07)', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement')),
      amountCents: 60_000,
      startDate: '2026-11-15',
    })
    const pending = await upload(
      user,
      accountId,
      bankFile(['12/11/2026;PRLV LOYER;600,00;']),
    )
    const previewed = await preview(user, pending.batch.id)
    const [row] = previewed.rows

    await validate(user, pending.batch.id, [
      {
        rowIndex: row?.rowIndex,
        include: true,
        categoryId: null,
        transferAccountId: null,
        reconcile: null,
      },
    ])

    expect(await operations(user)).toEqual([
      expect.objectContaining({ reconciled: false, origin: 'import' }),
    ])
  })
})

describe('EXE-05 unconfirmed generated operations', () => {
  it('flags the generated operations of an account that received an import', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement')),
      startDate: '2026-12-01',
    })
    await runWorker('2026-12-01')
    context.clock.set(new Date('2026-12-02T10:00:00Z'))
    expect((await operations(user))[0]?.unconfirmed).toBe(false)

    const pending = await upload(
      user,
      accountId,
      bankFile(['01/12/2026;CB X;1,00;']),
    )
    await preview(user, pending.batch.id)
    await validate(user, pending.batch.id, [
      {
        rowIndex: 1,
        include: true,
        categoryId: null,
        transferAccountId: null,
        reconcile: null,
      },
    ])

    expect(await operations(user, '?unconfirmed=true')).toEqual([
      expect.objectContaining({ origin: 'schedule', unconfirmed: true }),
    ])
    expect(await operations(user, '?reconciled=false')).toHaveLength(2)
  })
})

describe('RAP-05 manual reconciliation and OPE-07 conversion', () => {
  it('proposes, associates and dissociates an occurrence for a manual operation', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement')),
      amountCents: 60_000,
      startDate: '2026-11-15',
    })
    const operationId = await createOperation(user, accountId, {
      date: '2026-11-11',
      amountCents: -59_000,
      label: 'Loyer',
    })

    const candidates = await user.get(`/operations/${operationId}/candidates`)
    expect(candidates.body.candidates).toEqual([
      expect.objectContaining({ scheduleId, originalDate: '2026-11-15' }),
    ])
    const reconciled = await user.post(`/operations/${operationId}/reconcile`, {
      scheduleId,
      originalDate: '2026-11-15',
    })
    expect(reconciled.body).toMatchObject({ reconciled: true, scheduleId })
    expect(
      (
        await user.post(`/operations/${operationId}/reconcile`, {
          scheduleId,
          originalDate: '2026-11-15',
        })
      ).body,
    ).toEqual({ error: 'operation_reconciled' })

    const dissociated = await user.delete(
      `/operations/${operationId}/reconcile`,
    )
    expect(dissociated.body).toMatchObject({
      reconciled: false,
      scheduleId: null,
    })
    const occurrences = await user.get(`/schedules/${scheduleId}/occurrences`)
    expect(occurrences.body.occurrences[0]).toMatchObject({ status: 'pending' })
  })

  it('replaces the generated operation of an executed occurrence', async () => {
    const user = await client()
    const accountId = await createAccount(user)
    const scheduleId = await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement')),
      amountCents: 60_000,
      startDate: '2026-12-01',
    })
    await runWorker('2026-12-01')
    context.clock.set(new Date('2026-12-02T10:00:00Z'))
    const operationId = await createOperation(user, accountId, {
      date: '2026-12-02',
      amountCents: -60_000,
    })

    await user.post(`/operations/${operationId}/reconcile`, {
      scheduleId,
      originalDate: '2026-12-01',
    })

    expect(await operations(user)).toEqual([
      expect.objectContaining({ id: operationId, reconciled: true }),
    ])
  })

  it('converts an operation into a transfer, linking the opposite operation within 3 days', async () => {
    const user = await client()
    const checking = await createAccount(user)
    const savings = await createSavingsAccount(user)
    const debit = await createOperation(user, checking, {
      date: '2026-11-06',
      amountCents: -10_000,
    })
    const credit = await createOperation(user, savings, {
      date: '2026-11-08',
      amountCents: 10_000,
    })

    const response = await user.post(
      `/operations/${debit}/convert-to-transfer`,
      {
        counterpartAccountId: savings,
      },
    )

    expect(response.status).toBe(200)
    expect(response.body).toMatchObject({
      source: { id: debit, categoryId: null },
      target: { id: credit, counterpartAccountId: checking },
    })
    expect(
      (
        await user.post(`/operations/${debit}/convert-to-transfer`, {
          counterpartAccountId: savings,
        })
      ).body,
    ).toEqual({ error: 'operation_is_transfer' })
  })
})

describe('NF-PERF-03 import of 2 000 lines', () => {
  it('reads, applies the rules and looks for reconciliations in less than 5 seconds', async () => {
    const user = await client()
    const accountId = await createAccount(user, {
      initialBalanceDate: '2026-01-01',
    })
    const digital = await categoryId(user, 'Services numériques')
    for (const pattern of ['DEEZER', 'NETFLIX', 'SPOTIFY', 'EDF', 'ORANGE']) {
      await user.post('/rules', {
        matchType: 'contains',
        pattern,
        accountId: null,
        sign: 'any',
        amountMinCents: null,
        amountMaxCents: null,
        categoryId: digital,
        transferAccountId: null,
        active: true,
      })
    }
    await createSchedule(user, {
      ...expenseScheduleBody(accountId, await categoryId(user, 'Logement')),
      frequency: 'weekly',
      startDate: '2026-01-05',
    })
    const lines = Array.from({ length: 2_000 }, (_, index) => {
      const day = String((index % 28) + 1).padStart(2, '0')
      const month = String((index % 10) + 1).padStart(2, '0')
      return `${day}/${month}/2026;CB MAGASIN ${index % 97} DEEZER;${(index % 500) + 1},${String(index % 100).padStart(2, '0')};`
    })
    const pending = await upload(user, accountId, bankFile(lines))

    const started = performance.now()
    const previewed = await preview(user, pending.batch.id)
    const validated = await validate(user, pending.batch.id)
    const elapsed = performance.now() - started

    expect(previewed.rows).toHaveLength(2_000)
    expect(validated.rowsCreated).toBe(2_000)
    expect(elapsed).toBeLessThan(5_000)
  })
})
