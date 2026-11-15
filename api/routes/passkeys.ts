import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server'
import { UniqueConstraintError } from 'sequelize'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  maxPasskeysPerUser,
  passkeyAuthenticationOptionsSchema,
  passkeyListResponseSchema,
  passkeyLoginRequestSchema,
  passkeyRegistrationOptionsRequestSchema,
  passkeyRegistrationOptionsSchema,
  passkeyRegistrationRequestSchema,
  passkeySchema,
  renamePasskeyRequestSchema,
} from '@mint/shared/schemas/passkeys'
import type { PasskeyRegistrationResponse } from '@mint/shared/types/passkeys'
import { userProfileSchema } from '@mint/shared/schemas/user'
import { audit } from '../audit.js'
import { clientIp, ensureIpAllowed, recordIpFailure } from '../auth/guards.js'
import {
  assertionOptions,
  beginCeremony,
  ceremonyTimeoutMs,
  relyingParty,
  takeCeremony,
  toPasskey,
  userHandle,
  verifyAssertion,
} from '../auth/passkeys.js'
import { confirmCurrentPassword } from '../auth/password-confirmation.js'
import { startUserSession } from '../auth/session.js'
import { HttpError, notFound } from '../http/http-error.js'
import { definePublicRoute, defineUserRoute } from '../http/route.js'
import { describeError, log } from '../logger.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import type { AppDependencies } from '../types/app.js'
import type { WebauthnCredentialModel } from '../types/models.js'
import { toUserProfile } from '../users/users.js'

const tag = 'passkeys'

const accessErrors = {
  401: errorResponse('No valid session'),
}

function passkeyInvalid(status: 400 | 401): HttpError {
  return new HttpError({ status, code: 'passkey_invalid' })
}

async function userCredentials(
  app: AppDependencies,
  userId: string,
): Promise<WebauthnCredentialModel[]> {
  return app.models.WebauthnCredential.findAll({
    where: { userId },
    order: [['createdAt', 'ASC']],
  })
}

async function findUserCredential(
  app: AppDependencies,
  userId: string,
  id: string,
): Promise<WebauthnCredentialModel> {
  const credential = await app.models.WebauthnCredential.findOne({
    where: { id, userId },
  })
  if (credential === null) {
    throw notFound()
  }
  return credential
}

async function ensureBelowLimit(
  app: AppDependencies,
  userId: string,
): Promise<void> {
  const count = await app.models.WebauthnCredential.count({
    where: { userId },
  })
  if (count >= maxPasskeysPerUser) {
    throw new HttpError({ status: 409, code: 'passkey_limit' })
  }
}

async function verifiedRegistration(
  app: AppDependencies,
  registration: PasskeyRegistrationResponse,
  expectedChallenge: string,
) {
  const party = relyingParty(app)
  try {
    const verification = await verifyRegistrationResponse({
      response: registration,
      expectedChallenge,
      expectedOrigin: party.origin,
      expectedRPID: party.rpID,
      requireUserVerification: true,
    })
    return verification.verified ? verification.registrationInfo : null
  } catch (error) {
    log('info', 'passkey_registration_rejected', {
      error: describeError(error),
    })
    return null
  }
}

export const passkeyLoginOptionsRoute = definePublicRoute({
  method: 'post',
  path: '/auth/passkey/options',
  summary: 'Start a passkey login without email (AUTH-03)',
  tag: 'auth',
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'WebAuthn request options',
      schema: passkeyAuthenticationOptionsSchema,
    },
    429: errorResponse('Too many failed attempts from this address'),
  },
  handle: async ({ request, response, app }) => {
    ensureIpAllowed(app, clientIp(request))
    const options = await assertionOptions(app, [])
    beginCeremony(app, response, {
      challenge: options.challenge,
      purpose: 'login',
      userId: null,
    })
    return { status: 200, body: options }
  },
})

export const passkeyLoginRoute = definePublicRoute({
  method: 'post',
  path: '/auth/passkey/login',
  summary: 'Log in with a passkey (AUTH-03, US-03)',
  tag: 'auth',
  body: passkeyLoginRequestSchema,
  params: noParams,
  responses: {
    200: { description: 'Logged in', schema: userProfileSchema },
    400: errorResponse('Invalid request body'),
    401: errorResponse('Unknown, deleted or invalid passkey'),
    403: errorResponse('Disabled account'),
    429: errorResponse('Too many failed attempts from this address'),
  },
  handle: async ({ request, response, app, body }) => {
    const ip = clientIp(request)
    ensureIpAllowed(app, ip)
    const challenge = takeCeremony(app, request, response, 'login', null)
    const credential =
      challenge === null
        ? null
        : await verifyAssertion(app, body.response, challenge, null)
    if (credential === null) {
      audit('login_failed', { ip, method: 'passkey' })
      recordIpFailure(app, ip)
      throw passkeyInvalid(401)
    }
    const user = await app.models.User.findByPk(credential.userId)
    if (user === null) {
      throw passkeyInvalid(401)
    }
    if (user.status !== 'active') {
      audit('login_refused_disabled', { userId: user.id, ip })
      throw new HttpError({ status: 403, code: 'account_disabled' })
    }
    await startUserSession(request, user)
    await user.update({ lastLoginAt: app.clock.now() })
    audit('login_succeeded', { userId: user.id, ip, method: 'passkey' })
    return { status: 200, body: toUserProfile(user) }
  },
})

export const listPasskeysRoute = defineUserRoute({
  method: 'get',
  path: '/profile/passkeys',
  summary: 'List the passkeys of the logged in user (AUTH-03)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Passkeys', schema: passkeyListResponseSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => ({
    status: 200,
    body: (await userCredentials(app, user.id)).map(toPasskey),
  }),
})

export const passkeyRegistrationOptionsRoute = defineUserRoute({
  method: 'post',
  path: '/profile/passkeys/options',
  summary: 'Confirm the password and start a passkey registration',
  tag,
  body: passkeyRegistrationOptionsRequestSchema,
  params: noParams,
  responses: {
    200: {
      description: 'WebAuthn creation options',
      schema: passkeyRegistrationOptionsSchema,
    },
    400: errorResponse('Invalid body or wrong current password'),
    ...accessErrors,
    409: errorResponse('Passkey limit reached'),
    429: errorResponse('Account temporarily locked'),
  },
  handle: async ({ response, app, user, body }) => {
    await confirmCurrentPassword(app, user, body.password)
    await ensureBelowLimit(app, user.id)
    const party = relyingParty(app)
    const options = await generateRegistrationOptions({
      rpName: party.rpName,
      rpID: party.rpID,
      userName: user.email,
      userDisplayName: user.email,
      userID: userHandle(user.id),
      timeout: ceremonyTimeoutMs,
      attestationType: 'none',
      excludeCredentials: (await userCredentials(app, user.id)).map(
        (credential) => ({
          id: credential.credentialId,
          transports: credential.transports,
        }),
      ),
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
    })
    beginCeremony(app, response, {
      challenge: options.challenge,
      purpose: 'registration',
      userId: user.id,
    })
    return { status: 200, body: options }
  },
})

export const registerPasskeyRoute = defineUserRoute({
  method: 'post',
  path: '/profile/passkeys',
  summary: 'Register a named passkey (AUTH-03)',
  tag,
  body: passkeyRegistrationRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Passkey registered', schema: passkeySchema },
    400: errorResponse('Invalid body, expired ceremony or invalid passkey'),
    ...accessErrors,
    409: errorResponse('Passkey limit reached or passkey already registered'),
  },
  handle: async ({ request, response, app, user, body }) => {
    const challenge = takeCeremony(
      app,
      request,
      response,
      'registration',
      user.id,
    )
    const registration =
      challenge === null
        ? null
        : await verifiedRegistration(app, body.response, challenge)
    if (registration === null) {
      throw passkeyInvalid(400)
    }
    await ensureBelowLimit(app, user.id)
    try {
      const credential = await app.models.WebauthnCredential.create({
        userId: user.id,
        credentialId: registration.credential.id,
        publicKey: Buffer.from(registration.credential.publicKey),
        signCount: registration.credential.counter,
        transports: registration.credential.transports ?? [],
        name: body.name,
      })
      audit('passkey_registered', {
        userId: user.id,
        passkeyId: credential.id,
      })
      return { status: 201, body: toPasskey(credential) }
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new HttpError({ status: 409, code: 'passkey_exists' })
      }
      throw error
    }
  },
})

export const renamePasskeyRoute = defineUserRoute({
  method: 'patch',
  path: '/profile/passkeys/:id',
  summary: 'Rename a passkey',
  tag,
  body: renamePasskeyRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Passkey renamed', schema: passkeySchema },
    400: errorResponse('Invalid request body'),
    ...accessErrors,
    404: errorResponse('Unknown passkey'),
  },
  handle: async ({ app, user, params, body }) => {
    const credential = await findUserCredential(app, user.id, params.id)
    await credential.update({ name: body.name })
    audit('passkey_renamed', { userId: user.id, passkeyId: credential.id })
    return { status: 200, body: toPasskey(credential) }
  },
})

export const deletePasskeyRoute = defineUserRoute({
  method: 'delete',
  path: '/profile/passkeys/:id',
  summary: 'Delete a passkey: any later login with it is refused (US-03)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Passkey deleted' },
    ...accessErrors,
    404: errorResponse('Unknown passkey'),
  },
  handle: async ({ app, user, params }) => {
    const credential = await findUserCredential(app, user.id, params.id)
    await credential.destroy()
    audit('passkey_deleted', { userId: user.id, passkeyId: credential.id })
    return { status: 204 }
  },
})
