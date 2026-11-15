import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  maxPasskeysPerUser,
  passkeyAuthenticationOptionsSchema,
  passkeyListResponseSchema,
  passkeyRegistrationOptionsSchema,
  passkeySchema,
} from '@mint/shared/schemas/passkeys'
import { userProfileSchema } from '@mint/shared/schemas/user'
import {
  createClient,
  createTestContext,
  createTestUser,
  testPassword,
} from '../tests/context.js'
import { createSoftAuthenticator } from '../tests/webauthn.js'
import type { TestClient, TestContext } from '../types/tests.js'

const origin = 'http://mint.test'

let context: TestContext
let userCounter = 0

beforeAll(async () => {
  context = await createTestContext({ appOrigin: origin })
})

beforeEach(() => {
  context.clock.set(new Date('2026-11-11T10:00:00Z'))
})

afterAll(async () => {
  await context.close()
})

async function signedInUser() {
  userCounter += 1
  const user = await createTestUser(context, {
    email: `passkey-${userCounter}@example.org`,
  })
  const client = createClient(context.server)
  expect((await client.login(user.email)).status).toBe(200)
  return { user, client }
}

async function registerPasskey(
  client: TestClient,
  authenticator: ReturnType<typeof createSoftAuthenticator>,
  name = 'iPhone',
) {
  const optionsResponse = await client.post('/profile/passkeys/options', {
    password: testPassword,
  })
  expect(optionsResponse.status).toBe(200)
  const options = passkeyRegistrationOptionsSchema.parse(optionsResponse.body)
  return client.post('/profile/passkeys', {
    name,
    response: authenticator.register(options),
  })
}

async function passkeyLogin(
  authenticator: ReturnType<typeof createSoftAuthenticator>,
) {
  const client = createClient(context.server)
  const optionsResponse = await client.post('/auth/passkey/options')
  expect(optionsResponse.status).toBe(200)
  const options = passkeyAuthenticationOptionsSchema.parse(optionsResponse.body)
  const assertion = authenticator.authenticate(options)
  return {
    client,
    assertion,
    response: await client.post('/auth/passkey/login', { response: assertion }),
  }
}

describe('US-03 passkey login (AUTH-03)', () => {
  it('registers a named passkey and logs in without email, then refuses it once deleted', async () => {
    const { user, client } = await signedInUser()
    const authenticator = createSoftAuthenticator({ origin })

    const registered = await registerPasskey(client, authenticator)
    expect(registered.status).toBe(201)
    const passkey = passkeySchema.parse(registered.body)
    expect(passkey).toMatchObject({ name: 'iPhone', lastUsedAt: null })

    const login = await passkeyLogin(authenticator)
    expect(login.response.status).toBe(200)
    expect(userProfileSchema.parse(login.response.body).id).toBe(user.id)
    const session = await login.client.get('/auth/session')
    expect(session.status).toBe(200)

    const listed = passkeyListResponseSchema.parse(
      (await client.get('/profile/passkeys')).body,
    )
    expect(listed).toHaveLength(1)
    expect(listed[0]?.lastUsedAt).toBe('2026-11-11T10:00:00.000Z')

    expect(
      (await client.delete(`/profile/passkeys/${passkey.id}`)).status,
    ).toBe(204)
    const refused = await passkeyLogin(authenticator)
    expect(refused.response.status).toBe(401)
    expect(refused.response.body).toEqual({ error: 'passkey_invalid' })
    expect((await refused.client.get('/auth/session')).status).toBe(401)
  })

  it('offers the creation options only after the current password', async () => {
    const { client } = await signedInUser()

    const refused = await client.post('/profile/passkeys/options', {
      password: 'not-the-password',
    })
    expect(refused.status).toBe(400)
    expect(refused.body).toEqual({ error: 'invalid_credentials' })

    const accepted = await client.post('/profile/passkeys/options', {
      password: testPassword,
    })
    const options = passkeyRegistrationOptionsSchema.parse(accepted.body)
    expect(options.rp).toEqual({ name: 'Mint', id: 'mint.test' })
    expect(options.authenticatorSelection).toMatchObject({
      residentKey: 'required',
      userVerification: 'required',
    })
    expect(options.attestation).toBe('none')
  })

  it('refuses an assertion replayed or answered after five minutes', async () => {
    const { client } = await signedInUser()
    const authenticator = createSoftAuthenticator({ origin })
    expect((await registerPasskey(client, authenticator)).status).toBe(201)

    const login = await passkeyLogin(authenticator)
    expect(login.response.status).toBe(200)
    const replayed = await login.client.post('/auth/passkey/login', {
      response: login.assertion,
    })
    expect(replayed.status).toBe(401)

    const late = createClient(context.server)
    const options = passkeyAuthenticationOptionsSchema.parse(
      (await late.post('/auth/passkey/options')).body,
    )
    context.clock.advance(5 * 60 * 1000 + 1)
    const expired = await late.post('/auth/passkey/login', {
      response: authenticator.authenticate(options),
    })
    expect(expired.status).toBe(401)
  })

  it('requires user verification on registration', async () => {
    const { client } = await signedInUser()

    const response = await registerPasskey(
      client,
      createSoftAuthenticator({ origin, userVerified: false }),
    )

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'passkey_invalid' })
  })

  it('refuses the passkey of a disabled user', async () => {
    const { user, client } = await signedInUser()
    const authenticator = createSoftAuthenticator({ origin })
    expect((await registerPasskey(client, authenticator)).status).toBe(201)
    await user.update({ status: 'disabled' })

    const login = await passkeyLogin(authenticator)

    expect(login.response.status).toBe(403)
    expect(login.response.body).toEqual({ error: 'account_disabled' })
  })

  it('renames a passkey and caps the number of passkeys', async () => {
    const { user, client } = await signedInUser()
    const registered = passkeySchema.parse(
      (await registerPasskey(client, createSoftAuthenticator({ origin }))).body,
    )

    const renamed = await client.patch(`/profile/passkeys/${registered.id}`, {
      name: '  Mac du bureau  ',
    })
    expect(renamed.status).toBe(200)
    expect(passkeySchema.parse(renamed.body).name).toBe('Mac du bureau')
    const blank = await client.patch(`/profile/passkeys/${registered.id}`, {
      name: ' ',
    })
    expect(blank.status).toBe(400)

    await context.dependencies.models.WebauthnCredential.bulkCreate(
      Array.from({ length: maxPasskeysPerUser - 1 }, (_, index) => ({
        userId: user.id,
        credentialId: `extra-${userCounter}-${index}`,
        publicKey: Buffer.from([1]),
        name: `Clé ${index}`,
      })),
    )
    const limited = await client.post('/profile/passkeys/options', {
      password: testPassword,
    })
    expect(limited.status).toBe(409)
    expect(limited.body).toEqual({ error: 'passkey_limit' })
  })
})
