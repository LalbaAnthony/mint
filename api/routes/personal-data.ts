import { passkeyAuthenticationOptionsSchema } from '@mint/shared/schemas/passkeys'
import {
  accountDeletionRequestSchema,
  exportRequestSchema,
} from '@mint/shared/schemas/profile'
import { audit } from '../audit.js'
import {
  assertionOptions,
  beginCeremony,
  takeCeremony,
  verifyAssertion,
} from '../auth/passkeys.js'
import { confirmCurrentPassword } from '../auth/password-confirmation.js'
import { endSession } from '../auth/session.js'
import { HttpError } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import {
  deleteUserAccount,
  ensureNotLastAdministrator,
} from '../users/deletion.js'
import { buildExportArchive } from '../users/export.js'

const tag = 'personal-data'

export const exportMediaType = 'application/zip'

export const exportDataRoute = defineUserRoute({
  method: 'post',
  path: '/profile/export',
  summary:
    'Confirm the password and download a ZIP with a full JSON and one CSV per entity (AUTH-08)',
  tag,
  body: exportRequestSchema,
  params: noParams,
  responses: {
    200: { description: 'Export archive', mediaType: exportMediaType },
    400: errorResponse('Invalid body or wrong current password'),
    401: errorResponse('No valid session'),
    429: errorResponse('Account temporarily locked'),
  },
  handle: async ({ app, user, body }) => {
    await confirmCurrentPassword(app, user, body.password)
    const download = await buildExportArchive(app, user)
    audit('data_exported', { userId: user.id })
    return { status: 200, download }
  },
})

export const deletionPasskeyOptionsRoute = defineUserRoute({
  method: 'post',
  path: '/profile/delete/options',
  summary: 'Start a passkey confirmation of the account deletion (AUTH-09)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'WebAuthn request options for the passkeys of the user',
      schema: passkeyAuthenticationOptionsSchema,
    },
    401: errorResponse('No valid session'),
    409: errorResponse('The user has no passkey'),
  },
  handle: async ({ response, app, user }) => {
    const credentials = await app.models.WebauthnCredential.findAll({
      where: { userId: user.id },
    })
    if (credentials.length === 0) {
      throw new HttpError({ status: 409, code: 'no_passkey' })
    }
    const options = await assertionOptions(app, credentials)
    beginCeremony(app, response, {
      challenge: options.challenge,
      purpose: 'deletion',
      userId: user.id,
    })
    return { status: 200, body: options }
  },
})

export const deleteAccountDataRoute = defineUserRoute({
  method: 'post',
  path: '/profile/delete',
  summary:
    'Delete the account and all its data at once, after the email and a password or passkey confirmation (AUTH-09)',
  tag,
  body: accountDeletionRequestSchema,
  params: noParams,
  responses: {
    204: { description: 'Account deleted, logged out' },
    400: errorResponse(
      'Invalid body, email mismatch, wrong password or invalid passkey',
    ),
    401: errorResponse('No valid session'),
    409: errorResponse('Last active administrator'),
    429: errorResponse('Account temporarily locked'),
  },
  handle: async ({ request, response, app, user, body }) => {
    if (body.email.toLowerCase() !== user.email.toLowerCase()) {
      throw new HttpError({ status: 400, code: 'email_mismatch' })
    }
    await ensureNotLastAdministrator(app, user)
    if (body.method === 'password') {
      await confirmCurrentPassword(app, user, body.password)
    } else {
      const challenge = takeCeremony(
        app,
        request,
        response,
        'deletion',
        user.id,
      )
      const credential =
        challenge === null
          ? null
          : await verifyAssertion(app, body.response, challenge, user.id)
      if (credential === null) {
        throw new HttpError({ status: 400, code: 'passkey_invalid' })
      }
    }
    const userId = user.id
    await deleteUserAccount(app, user)
    await endSession(request, response, app)
    audit('account_deleted', { userId, method: body.method })
    return { status: 204 }
  },
})
