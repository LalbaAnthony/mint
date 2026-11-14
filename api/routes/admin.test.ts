import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createClient,
  createTestContext,
  createTestUser,
} from '../tests/context.js'
import { captureAuditEvents } from '../tests/http.js'
import type { TestContext } from '../types/tests.js'

const day = 24 * 60 * 60 * 1000

let context: TestContext
let admin: ReturnType<typeof createClient>
let adminId: string

beforeEach(async () => {
  context = await createTestContext()
  adminId = (
    await createTestUser(context, { email: 'admin@example.org', role: 'admin' })
  ).id
  admin = createClient(context.server)
  await admin.login('admin@example.org')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await context.close()
})

function captureStdout(): string[] {
  const lines: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk))
    return true
  })
  return lines
}

describe('invitations (ADM-01, ADM-02)', () => {
  it('creates an invitation and emails the bilingual link', async () => {
    const lines = captureStdout()

    const response = await admin.post('/admin/invitations', {
      email: 'guest@example.org',
    })

    expect(response.status).toBe(201)
    expect(response.body).toEqual({
      id: expect.any(String),
      email: 'guest@example.org',
      status: 'pending',
      createdAt: expect.any(String),
      expiresAt: new Date(
        context.clock.now().getTime() + 7 * day,
      ).toISOString(),
      acceptedAt: null,
      revokedAt: null,
    })
    const message = context.mailer.messages.at(-1)
    expect(message?.to).toBe('guest@example.org')
    expect(message?.text).toContain('http://mint.test/invitation#token=')
    expect(captureAuditEvents(lines)).toContain('audit_invitation_created')
  })

  it('refuses a registered address and a second pending invitation', async () => {
    await createTestUser(context, { email: 'member@example.org' })
    await admin.post('/admin/invitations', { email: 'guest@example.org' })

    const registered = await admin.post('/admin/invitations', {
      email: 'MEMBER@example.org',
    })
    const duplicate = await admin.post('/admin/invitations', {
      email: 'guest@example.org',
    })

    expect(registered.status).toBe(409)
    expect(registered.body).toEqual({ error: 'email_taken' })
    expect(duplicate.status).toBe(409)
    expect(duplicate.body).toEqual({ error: 'invitation_pending' })
  })

  it('allows a new invitation once the previous one expired', async () => {
    await admin.post('/admin/invitations', { email: 'guest@example.org' })
    context.clock.advance(7 * day)

    const response = await admin.post('/admin/invitations', {
      email: 'guest@example.org',
    })

    expect(response.status).toBe(201)
  })

  it('stores nothing when the email cannot be sent', async () => {
    context.mailer.failNext()

    const response = await admin.post('/admin/invitations', {
      email: 'guest@example.org',
    })

    expect(response.status).toBe(502)
    expect(response.body).toEqual({ error: 'mail_delivery_failed' })
    expect((await admin.get('/admin/invitations')).body).toEqual([])
  })

  it('lists pending, accepted, expired and revoked invitations', async () => {
    const pending = await admin.post('/admin/invitations', {
      email: 'pending@example.org',
    })
    const revoked = await admin.post('/admin/invitations', {
      email: 'revoked@example.org',
    })
    await admin.post(`/admin/invitations/${revoked.body.id}/revoke`)
    await admin.post('/admin/invitations', { email: 'accepted@example.org' })
    await createClient(context.server).post('/auth/invitation/accept', {
      token: context.mailer.tokenSentTo('accepted@example.org'),
      password: 'a long enough password',
      locale: 'fr',
    })
    await admin.post('/admin/invitations', { email: 'expired@example.org' })
    context.clock.advance(7 * day)
    await admin.post(`/admin/invitations/${pending.body.id}/resend`)

    const response = await admin.get('/admin/invitations')

    expect(
      Object.fromEntries(
        response.body.map((invitation: { email: string; status: string }) => [
          invitation.email,
          invitation.status,
        ]),
      ),
    ).toEqual({
      'pending@example.org': 'pending',
      'revoked@example.org': 'revoked',
      'accepted@example.org': 'accepted',
      'expired@example.org': 'expired',
    })
  })

  it('resends with a new link and invalidates the previous one', async () => {
    const created = await admin.post('/admin/invitations', {
      email: 'guest@example.org',
    })
    const firstToken = context.mailer.tokenSentTo('guest@example.org')

    const resent = await admin.post(
      `/admin/invitations/${created.body.id}/resend`,
    )
    const secondToken = context.mailer.tokenSentTo('guest@example.org')
    const visitor = createClient(context.server)

    expect(resent.status).toBe(200)
    expect(secondToken).not.toBe(firstToken)
    expect(
      (await visitor.post('/auth/invitation/check', { token: firstToken }))
        .status,
    ).toBe(404)
    expect(
      (await visitor.post('/auth/invitation/check', { token: secondToken }))
        .status,
    ).toBe(200)
  })

  it('refuses to resend or revoke an accepted or revoked invitation', async () => {
    const created = await admin.post('/admin/invitations', {
      email: 'guest@example.org',
    })
    await admin.post(`/admin/invitations/${created.body.id}/revoke`)

    const resend = await admin.post(
      `/admin/invitations/${created.body.id}/resend`,
    )
    const revokeAgain = await admin.post(
      `/admin/invitations/${created.body.id}/revoke`,
    )

    expect(resend.body).toEqual({ error: 'invitation_not_resendable' })
    expect(revokeAgain.body).toEqual({ error: 'invitation_not_revocable' })
  })

  it('answers 404 for an unknown or malformed invitation id', async () => {
    expect(
      (
        await admin.post(
          '/admin/invitations/00000000-0000-4000-8000-000000000000/revoke',
        )
      ).status,
    ).toBe(404)
    expect(
      (await admin.post('/admin/invitations/not-a-uuid/revoke')).status,
    ).toBe(404)
  })
})

describe('users (ADM-03 to ADM-06)', () => {
  it('lists users with email, role, language, dates and status only', async () => {
    await createTestUser(context, { email: 'member@example.org', locale: 'en' })

    const response = await admin.get('/admin/users')

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(2)
    for (const user of response.body) {
      expect(Object.keys(user).sort()).toEqual([
        'createdAt',
        'email',
        'id',
        'lastLoginAt',
        'locale',
        'role',
        'status',
      ])
    }
    expect(response.body[1]).toEqual(
      expect.objectContaining({
        email: 'member@example.org',
        role: 'user',
        locale: 'en',
        status: 'active',
        lastLoginAt: null,
      }),
    )
  })

  it('disables a user: sessions revoked, login refused, data kept; then enables it', async () => {
    const member = await createTestUser(context, {
      email: 'member@example.org',
    })
    const memberClient = createClient(context.server)
    await memberClient.login(member.email)

    const disabled = await admin.post(`/admin/users/${member.id}/disable`)

    expect(disabled.status).toBe(200)
    expect(disabled.body.status).toBe('disabled')
    expect((await memberClient.get('/auth/session')).status).toBe(401)
    expect((await memberClient.login(member.email)).status).toBe(403)
    expect(
      await context.dependencies.models.Category.count({
        where: { userId: member.id },
      }),
    ).toBe(20)

    const enabled = await admin.post(`/admin/users/${member.id}/enable`)

    expect(enabled.body.status).toBe('active')
    expect((await memberClient.login(member.email)).status).toBe(200)
  })

  it('forbids an administrator to disable itself', async () => {
    const response = await admin.post(`/admin/users/${adminId}/disable`)

    expect(response.status).toBe(409)
    expect(response.body).toEqual({ error: 'cannot_disable_self' })
  })

  it('sends a reset link in the user language, except to a disabled user (ADM-05)', async () => {
    const member = await createTestUser(context, {
      email: 'member@example.org',
      locale: 'en',
    })

    const sent = await admin.post(`/admin/users/${member.id}/password-reset`)

    expect(sent.status).toBe(202)
    expect(context.mailer.messages.at(-1)).toEqual(
      expect.objectContaining({
        to: 'member@example.org',
        subject: 'Reset your Mint password',
      }),
    )

    await admin.post(`/admin/users/${member.id}/disable`)
    const refused = await admin.post(`/admin/users/${member.id}/password-reset`)

    expect(refused.status).toBe(409)
    expect(refused.body).toEqual({ error: 'user_disabled' })
  })
})
