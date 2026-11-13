import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import type { TestContext } from '../types/tests.js'

const minute = 60 * 1000
const newPassword = 'another long password'

let context: TestContext
let counter = 0

beforeAll(async () => {
  context = await createTestContext()
})

afterAll(async () => {
  await context.close()
})

async function newUser(locale: 'fr' | 'en' = 'fr') {
  counter += 1
  return createTestUser(context, {
    email: `reset-${counter}@example.org`,
    locale,
  })
}

async function requestReset(email: string) {
  const response = await createClient(context.server).post(
    '/auth/password-reset/request',
    { email },
  )
  expect(response.status).toBe(202)
  return response
}

async function waitForToken(email: string): Promise<string> {
  await vi.waitFor(() => context.mailer.tokenSentTo(email))
  return context.mailer.tokenSentTo(email)
}

describe('password reset (AUTH-04)', () => {
  it('answers the same way whether the address exists or not', async () => {
    const user = await newUser()
    const sentBefore = context.mailer.messages.length

    const known = await requestReset(user.email)
    const unknown = await requestReset('nobody-here@example.org')

    expect(unknown.body).toEqual(known.body)
    await waitForToken(user.email)
    expect(context.mailer.messages.length).toBe(sentBefore + 1)
  })

  it('sends the link in the user language', async () => {
    const user = await newUser('en')

    await requestReset(user.email)
    await waitForToken(user.email)

    expect(context.mailer.messages.at(-1)?.subject).toBe(
      'Reset your Mint password',
    )
  })

  it('sets the new password once and revokes every session (AUTH-05)', async () => {
    const user = await newUser()
    const loggedIn = createClient(context.server)
    await loggedIn.login(user.email)
    await requestReset(user.email)
    const token = await waitForToken(user.email)
    const visitor = createClient(context.server)

    const first = await visitor.post('/auth/password-reset/confirm', {
      token,
      password: newPassword,
    })
    const second = await visitor.post('/auth/password-reset/confirm', {
      token,
      password: 'yet another password',
    })

    expect(first.status).toBe(204)
    expect(second.status).toBe(404)
    expect(second.body).toEqual({ error: 'token_invalid' })
    expect((await loggedIn.get('/auth/session')).status).toBe(401)
    expect((await visitor.login(user.email)).status).toBe(401)
    expect((await visitor.login(user.email, newPassword)).status).toBe(200)
  })

  it('expires the link after 1 hour', async () => {
    const user = await newUser()
    await requestReset(user.email)
    const token = await waitForToken(user.email)

    context.clock.advance(60 * minute)

    const response = await createClient(context.server).post(
      '/auth/password-reset/confirm',
      { token, password: newPassword },
    )
    expect(response.status).toBe(410)
    expect(response.body).toEqual({ error: 'token_expired' })
  })

  it('invalidates the previous link when a new one is requested', async () => {
    const user = await newUser()
    await requestReset(user.email)
    const firstToken = await waitForToken(user.email)
    await requestReset(user.email)
    await vi.waitFor(() =>
      expect(context.mailer.tokenSentTo(user.email)).not.toBe(firstToken),
    )

    const response = await createClient(context.server).post(
      '/auth/password-reset/confirm',
      { token: firstToken, password: newPassword },
    )

    expect(response.status).toBe(404)
  })

  it('sends nothing to a disabled user', async () => {
    const user = await newUser()
    await user.update({ status: 'disabled' })
    const sentBefore = context.mailer.messages.length

    await requestReset(user.email)

    expect(context.mailer.messages.length).toBe(sentBefore)
  })

  it('requires a 12-character password', async () => {
    const user = await newUser()
    await requestReset(user.email)
    const token = await waitForToken(user.email)

    const response = await createClient(context.server).post(
      '/auth/password-reset/confirm',
      { token, password: 'short' },
    )

    expect(response.status).toBe(400)
    expect(
      (await createClient(context.server).login(user.email, testPassword))
        .status,
    ).toBe(200)
  })
})
