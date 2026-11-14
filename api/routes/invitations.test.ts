import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import type { TestContext } from '../types/tests.js'

let context: TestContext
let admin: ReturnType<typeof createClient>

const newPassword = 'a brand new password'

beforeEach(async () => {
  context = await createTestContext({
    now: new Date('2026-12-01T09:00:00+01:00'),
  })
  await createTestUser(context, { email: 'admin@example.org', role: 'admin' })
  admin = createClient(context.server)
  await admin.login('admin@example.org')
})

afterEach(async () => {
  await context.close()
})

async function invite(email: string): Promise<string> {
  const response = await admin.post('/admin/invitations', { email })
  expect(response.status).toBe(201)
  return context.mailer.tokenSentTo(email)
}

describe('US-01 Inviter un proche (ADM-01, AUTH-01)', () => {
  it('lets the invitee opened on 5 December set password and language, then lands on an empty space with the default and system categories (CAT-05, CAT-08)', async () => {
    const token = await invite('proche@example.org')
    context.clock.set(new Date('2026-12-05T20:00:00+01:00'))
    const invitee = createClient(context.server)

    const check = await invitee.post('/auth/invitation/check', { token })
    const accept = await invitee.post('/auth/invitation/accept', {
      token,
      password: newPassword,
      locale: 'en',
    })

    expect(check.status).toBe(200)
    expect(check.body).toEqual({ email: 'proche@example.org' })
    expect(accept.status).toBe(201)
    expect(accept.body).toEqual(
      expect.objectContaining({
        email: 'proche@example.org',
        role: 'user',
        locale: 'en',
      }),
    )
    expect((await invitee.get('/auth/session')).body.id).toBe(accept.body.id)
    const categories = await context.dependencies.models.Category.findAll({
      where: { userId: accept.body.id },
      order: [['sortOrder', 'ASC']],
    })
    expect(
      categories.map(({ kind, expenseGroup, name }) => [
        kind,
        expenseGroup,
        name,
      ]),
    ).toEqual([
      ['expense', 'needs', 'Housing'],
      ['expense', 'needs', 'Groceries'],
      ['expense', 'needs', 'Food'],
      ['expense', 'needs', 'Transport'],
      ['expense', 'needs', 'Health'],
      ['expense', 'needs', 'Energy and telecoms'],
      ['expense', 'needs', 'Insurance'],
      ['expense', 'wants', 'Leisure'],
      ['expense', 'wants', 'Restaurants'],
      ['expense', 'wants', 'Shopping'],
      ['expense', 'wants', 'Sport'],
      ['expense', 'wants', 'Digital services'],
      ['expense', 'wants', 'Travel'],
      ['income', null, 'Salary'],
      ['income', null, 'Benefits'],
      ['income', null, 'Bonuses'],
      ['income', null, 'Refunds'],
      ['income', null, 'Other income'],
      ['income', null, 'Interest'],
      ['adjustment', null, 'Adjustment'],
    ])
  })

  it('creates the French default categories for a French invitee', async () => {
    const token = await invite('francais@example.org')
    const invitee = createClient(context.server)

    const accept = await invitee.post('/auth/invitation/accept', {
      token,
      password: newPassword,
      locale: 'fr',
    })

    const names = (
      await context.dependencies.models.Category.findAll({
        where: { userId: accept.body.id },
        order: [['sortOrder', 'ASC']],
      })
    ).map((category) => category.name)
    expect(names.slice(0, 7)).toEqual([
      'Logement',
      'Courses',
      'Alimentation',
      'Transports',
      'Santé',
      'Énergie et télécoms',
      'Assurances',
    ])
    expect(names.slice(-3)).toEqual([
      'Autres revenus',
      'Intérêts',
      'Ajustement',
    ])
  })

  it('shows the expiry on 9 December and creates no account', async () => {
    const token = await invite('tardif@example.org')
    context.clock.set(new Date('2026-12-09T09:00:00+01:00'))
    const invitee = createClient(context.server)

    const check = await invitee.post('/auth/invitation/check', { token })
    const accept = await invitee.post('/auth/invitation/accept', {
      token,
      password: newPassword,
      locale: 'fr',
    })

    expect(check.status).toBe(410)
    expect(check.body).toEqual({ error: 'invitation_expired' })
    expect(accept.status).toBe(410)
    expect(
      await context.dependencies.models.User.count({
        where: { email: 'tardif@example.org' },
      }),
    ).toBe(0)
  })

  it('refuses a link that was already accepted', async () => {
    const token = await invite('deja@example.org')
    await createClient(context.server).post('/auth/invitation/accept', {
      token,
      password: newPassword,
      locale: 'fr',
    })
    const again = createClient(context.server)

    const check = await again.post('/auth/invitation/check', { token })
    const accept = await again.post('/auth/invitation/accept', {
      token,
      password: 'another password here',
      locale: 'fr',
    })

    expect(check.status).toBe(404)
    expect(check.body).toEqual({ error: 'invitation_invalid' })
    expect(accept.status).toBe(404)
  })

  it('accepts the invitation only once under concurrent submissions', async () => {
    const token = await invite('double@example.org')
    const body = { token, password: newPassword, locale: 'fr' }

    const statuses = (
      await Promise.all([
        createClient(context.server).post('/auth/invitation/accept', body),
        createClient(context.server).post('/auth/invitation/accept', body),
      ])
    ).map((response) => response.status)

    expect(statuses.sort()).toEqual([201, 404])
    expect(
      await context.dependencies.models.User.count({
        where: { email: 'double@example.org' },
      }),
    ).toBe(1)
  })

  it('refuses a revoked link and an unknown one', async () => {
    const token = await invite('revoque@example.org')
    const [invitation] = (await admin.get('/admin/invitations')).body
    await admin.post(`/admin/invitations/${invitation.id}/revoke`)
    const invitee = createClient(context.server)

    expect(
      (await invitee.post('/auth/invitation/check', { token })).status,
    ).toBe(404)
    expect(
      (
        await invitee.post('/auth/invitation/check', {
          token: 'x'.repeat(43),
        })
      ).status,
    ).toBe(404)
  })

  it('rejects a weak password without consuming the invitation', async () => {
    const token = await invite('faible@example.org')
    const invitee = createClient(context.server)

    const weak = await invitee.post('/auth/invitation/accept', {
      token,
      password: 'short',
      locale: 'fr',
    })
    const strong = await invitee.post('/auth/invitation/accept', {
      token,
      password: newPassword,
      locale: 'fr',
    })

    expect(weak.status).toBe(400)
    expect(weak.body.issues).toEqual([
      { path: ['password'], message: 'password_too_short' },
    ])
    expect(strong.status).toBe(201)
  })

  it('refuses the invitation when the address registered meanwhile', async () => {
    const token = await invite('entretemps@example.org')
    await createTestUser(context, { email: 'entretemps@example.org' })

    const response = await createClient(context.server).post(
      '/auth/invitation/accept',
      { token, password: testPassword, locale: 'fr' },
    )

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'email_taken' })
  })
})
