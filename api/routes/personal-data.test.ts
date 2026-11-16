import { QueryTypes } from 'sequelize'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  passkeyAuthenticationOptionsSchema,
  passkeyRegistrationOptionsSchema,
} from '@mint/shared/schemas/passkeys'
import { apiPrefix } from '../app.js'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import {
  categoryId,
  createAccount,
  createOperation,
  createSavingsAccount,
  createSchedule,
  envelopeBody,
  expenseScheduleBody,
  readId,
  transferBody,
} from '../tests/fixtures.js'
import { createSoftAuthenticator } from '../tests/webauthn.js'
import { readZip } from '../tests/zip.js'
import type { TestClient, TestContext } from '../types/tests.js'

const origin = 'http://mint.test'

const exportDocumentSchema = z.object({
  format: z.literal('mint-export'),
  version: z.literal(1),
  profile: z.object({ email: z.string() }),
  accounts: z.array(z.object({ name: z.string() })),
  operations: z.array(
    z.object({ label: z.string(), tagIds: z.array(z.uuid()) }),
  ),
  schedules: z.array(z.object({ isSystem: z.boolean() })),
  envelopeMonthOverrides: z.array(
    z.object({ month: z.string(), amountCents: z.number() }),
  ),
  categories: z.array(z.unknown()),
  passkeys: z.array(z.object({ name: z.string() })),
})

const userIdRowsSchema = z.array(z.object({ table_name: z.string() }))

const countRowsSchema = z.array(z.object({ count: z.coerce.number() }))

let context: TestContext
let userCounter = 0

beforeAll(async () => {
  context = await createTestContext({
    appOrigin: origin,
    now: new Date('2026-12-15T10:00:00Z'),
  })
})

afterAll(async () => {
  await context.close()
})

async function signedInUser(role: 'user' | 'admin' = 'user') {
  userCounter += 1
  const user = await createTestUser(context, {
    email: `personal-${userCounter}@example.org`,
    role,
  })
  const client = createClient(context.server)
  expect((await client.login(user.email)).status).toBe(200)
  return { user, client }
}

async function populate(client: TestClient): Promise<void> {
  const currentId = await createAccount(client)
  const livretId = await createSavingsAccount(client)
  const peaId = await createAccount(client, {
    name: 'PEA',
    nature: 'securities_account',
    usage: 'investment',
  })
  const groceries = await categoryId(client, 'Courses')
  const tagId = readId((await client.post('/tags', { name: 'Vacances' })).body)
  await createOperation(client, currentId, {
    date: '2026-12-05',
    label: '=SUM(A1)',
    categoryId: groceries,
    tagIds: [tagId],
  })
  expect(
    (
      await client.post(
        '/transfers',
        transferBody(currentId, livretId, { date: '2026-12-06' }),
      )
    ).status,
  ).toBe(201)
  await createSchedule(client, expenseScheduleBody(currentId, groceries))
  const envelope = await client.post(
    '/envelopes',
    envelopeBody(currentId, [groceries]),
  )
  expect(envelope.status).toBe(201)
  expect(
    (
      await client.post(
        `/envelopes/${readId(envelope.body)}/months/2027-01-01`,
        {
          amountCents: 0,
        },
      )
    ).status,
  ).toBe(200)
  expect(
    (
      await client.post('/rules', {
        matchType: 'contains',
        pattern: 'DEEZER',
        accountId: null,
        sign: 'any',
        amountMinCents: null,
        amountMaxCents: null,
        categoryId: groceries,
        transferAccountId: null,
        active: true,
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await client.post(`/accounts/${currentId}/statements`, {
        date: '2026-12-10',
        balanceCents: 85_500,
      })
    ).status,
  ).toBe(201)
  expect(
    (
      await client.post(`/accounts/${peaId}/valuations`, {
        date: '2026-12-10',
        valueCents: 150_000,
      })
    ).status,
  ).toBe(201)
}

async function downloadExport(client: TestClient, password = testPassword) {
  return client.agent
    .post(`${apiPrefix}/profile/export`)
    .set('X-CSRF-Token', await client.csrfToken())
    .send({ password })
    .buffer(true)
    .parse((response, callback) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(chunk))
      response.on('end', () => callback(null, Buffer.concat(chunks)))
    })
}

function csvLines(content: Buffer | undefined): string[] {
  const text = content?.toString('utf8') ?? ''
  expect(text.startsWith('\u{FEFF}')).toBe(true)
  return text.slice(1).split('\r\n').slice(0, -1)
}

async function rowsOwnedBy(userId: string): Promise<Record<string, number>> {
  const { sequelize } = context.dependencies
  const tables = userIdRowsSchema.parse(
    await sequelize.query(
      `SELECT table_name FROM information_schema.columns
       WHERE table_schema = 'public' AND column_name = 'user_id'
       ORDER BY table_name`,
      { type: QueryTypes.SELECT },
    ),
  )
  const counts: Record<string, number> = {}
  for (const { table_name: table } of tables) {
    const [row] = countRowsSchema.parse(
      await sequelize.query(
        `SELECT count(*) AS count FROM "${table}" WHERE user_id = :userId`,
        { replacements: { userId }, type: QueryTypes.SELECT },
      ),
    )
    counts[table] = row?.count ?? 0
  }
  return counts
}

async function registerPasskey(
  client: TestClient,
  authenticator: ReturnType<typeof createSoftAuthenticator>,
): Promise<void> {
  const options = passkeyRegistrationOptionsSchema.parse(
    (
      await client.post('/profile/passkeys/options', {
        password: testPassword,
      })
    ).body,
  )
  const registered = await client.post('/profile/passkeys', {
    name: 'iPhone',
    response: authenticator.register(options),
  })
  expect(registered.status).toBe(201)
}

describe('US-19 export (AUTH-08)', () => {
  it('downloads a ZIP with a full JSON and one CSV per entity, in the profile language', async () => {
    const { user, client } = await signedInUser()
    await populate(client)
    const bob = await signedInUser()
    await createAccount(bob.client, { name: 'Compte de Bob' })

    const response = await downloadExport(client)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toBe('application/zip')
    expect(response.headers['content-disposition']).toBe(
      'attachment; filename=mint-export-2026-12-15.zip',
    )
    expect(response.headers['cache-control']).toBe('no-store')
    expect(Buffer.isBuffer(response.body)).toBe(true)
    const entries = readZip(z.instanceof(Buffer).parse(response.body))
    expect([...entries.keys()]).toEqual([
      'mint-export.json',
      'comptes.csv',
      'operations.csv',
      'echeances.csv',
      'enveloppes.csv',
      'categories.csv',
      'tags.csv',
      'regles.csv',
      'releves.csv',
      'valorisations.csv',
    ])

    const json = entries.get('mint-export.json')?.toString('utf8') ?? ''
    expect(json).not.toContain('passwordHash')
    expect(json).not.toContain('"userId"')
    expect(json).not.toContain('Compte de Bob')
    const document = exportDocumentSchema.parse(JSON.parse(json))
    expect(document.profile.email).toBe(user.email)
    expect(document.accounts.map((account) => account.name)).toEqual([
      'Compte courant',
      'Livret A',
      'PEA',
    ])
    expect(document.operations).toHaveLength(3)
    expect(document.operations[0]?.tagIds).toHaveLength(1)
    expect(document.schedules.filter((row) => row.isSystem)).toHaveLength(1)
    expect(document.envelopeMonthOverrides).toEqual([
      expect.objectContaining({ month: '2027-01-01', amountCents: 0 }),
    ])

    expect(csvLines(entries.get('comptes.csv'))).toHaveLength(1 + 3)
    expect(csvLines(entries.get('echeances.csv'))).toHaveLength(1 + 1)
    expect(csvLines(entries.get('categories.csv'))).toHaveLength(
      1 + document.categories.length,
    )
    const operations = csvLines(entries.get('operations.csv'))
    expect(operations).toHaveLength(1 + 3)
    expect(operations[0]).toBe(
      'Date;Compte;Montant;Libellé;Libellé bancaire;Catégorie;Tags;Moyen de paiement;Compte de contrepartie;Note;Statut;Origine',
    )
    expect(operations[1]).toBe(
      "2026-12-05;Compte courant;-45,00;'=SUM(A1);;Courses;Vacances;;;;categorized;manual",
    )
    expect(operations.slice(2)).toEqual(
      expect.arrayContaining([
        '2026-12-06;Compte courant;-100,00;Epargne;;;;;Livret A;;categorized;manual',
        '2026-12-06;Livret A;100,00;Epargne;;;;;Compte courant;;categorized;manual',
      ]),
    )
    expect(csvLines(entries.get('releves.csv'))).toEqual([
      'Compte;Date;Solde',
      'Compte courant;2026-12-10;855,00',
    ])
    expect(csvLines(entries.get('valorisations.csv'))).toEqual([
      'Compte;Date;Valeur',
      'PEA;2026-12-10;1500,00',
    ])
  })

  it('asks for the current password', async () => {
    const { client } = await signedInUser()

    const response = await client.post('/profile/export', {
      password: 'not-the-password',
    })

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'invalid_credentials' })
  })
})

describe('US-19 account deletion (AUTH-09)', () => {
  it('erases every row of the user and lets the address be invited again', async () => {
    const { user, client } = await signedInUser()
    await populate(client)
    await registerPasskey(client, createSoftAuthenticator({ origin }))
    const { models } = context.dependencies
    await models.Invitation.create({
      email: user.email,
      tokenHash: `accepted-${user.id}`,
      invitedBy: null,
      expiresAt: new Date('2026-11-01T00:00:00Z'),
      acceptedAt: new Date('2026-10-30T00:00:00Z'),
    })
    const before = await rowsOwnedBy(user.id)
    expect(before['transactions']).toBe(3)
    expect(before['webauthn_credentials']).toBe(1)

    const response = await client.post('/profile/delete', {
      method: 'password',
      email: user.email.toUpperCase(),
      password: testPassword,
    })

    expect(response.status).toBe(204)
    expect((await client.get('/auth/session')).status).toBe(401)
    expect(
      Object.values(await rowsOwnedBy(user.id)).every((n) => n === 0),
    ).toBe(true)
    expect(await models.User.findByPk(user.id)).toBeNull()
    expect(
      await models.Invitation.count({ where: { email: user.email } }),
    ).toBe(0)
    const admin = await signedInUser('admin')
    const invited = await admin.client.post('/admin/invitations', {
      email: user.email,
    })
    expect(invited.status).toBe(201)
  })

  it('requires the email of the account and the right password', async () => {
    const { user, client } = await signedInUser()

    const mismatch = await client.post('/profile/delete', {
      method: 'password',
      email: 'someone-else@example.org',
      password: testPassword,
    })
    expect(mismatch.status).toBe(400)
    expect(mismatch.body).toEqual({ error: 'email_mismatch' })

    const wrongPassword = await client.post('/profile/delete', {
      method: 'password',
      email: user.email,
      password: 'not-the-password',
    })
    expect(wrongPassword.status).toBe(400)
    expect(wrongPassword.body).toEqual({ error: 'invalid_credentials' })
    expect(
      await context.dependencies.models.User.findByPk(user.id),
    ).not.toBeNull()
  })

  it('refuses the deletion of the last active administrator', async () => {
    const { models } = context.dependencies
    await models.User.update(
      { status: 'disabled' },
      { where: { role: 'admin' } },
    )
    const { user, client } = await signedInUser('admin')
    const body = {
      method: 'password',
      email: user.email,
      password: testPassword,
    }

    const refused = await client.post('/profile/delete', body)
    expect(refused.status).toBe(409)
    expect(refused.body).toEqual({ error: 'last_admin' })

    await signedInUser('admin')
    expect((await client.post('/profile/delete', body)).status).toBe(204)
  })

  it('accepts a passkey of the user as confirmation, and only one of his', async () => {
    const alice = await signedInUser()
    const bob = await signedInUser()
    const aliceKey = createSoftAuthenticator({ origin })
    const bobKey = createSoftAuthenticator({ origin })
    await registerPasskey(alice.client, aliceKey)
    await registerPasskey(bob.client, bobKey)

    const options = passkeyAuthenticationOptionsSchema.parse(
      (await alice.client.post('/profile/delete/options')).body,
    )
    expect(
      options.allowCredentials?.map((credential) => credential.id),
    ).toEqual([aliceKey.credentialId])
    const foreign = await alice.client.post('/profile/delete', {
      method: 'passkey',
      email: alice.user.email,
      response: bobKey.authenticate(options),
    })
    expect(foreign.status).toBe(400)
    expect(foreign.body).toEqual({ error: 'passkey_invalid' })

    const renewed = passkeyAuthenticationOptionsSchema.parse(
      (await alice.client.post('/profile/delete/options')).body,
    )
    const deleted = await alice.client.post('/profile/delete', {
      method: 'passkey',
      email: alice.user.email,
      response: aliceKey.authenticate(renewed),
    })
    expect(deleted.status).toBe(204)
  })

  it('offers no passkey confirmation without passkey', async () => {
    const { client } = await signedInUser()

    const response = await client.post('/profile/delete/options')

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'no_passkey' })
  })
})
