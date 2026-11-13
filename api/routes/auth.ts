import { Op, UniqueConstraintError } from 'sequelize'
import {
  acceptInvitationRequestSchema,
  emailChangeConfirmRequestSchema,
  invitationStatusResponseSchema,
  invitationTokenRequestSchema,
  loginRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
} from '@mint/shared/schemas/auth'
import { userProfileSchema } from '@mint/shared/schemas/user'
import { audit } from '../audit.js'
import {
  accountKey,
  clientIp,
  ensureAccountAllowed,
  ensureIpAllowed,
  recordAccountFailure,
  recordIpFailure,
} from '../auth/guards.js'
import {
  hashPassword,
  verifyAgainstDecoy,
  verifyPassword,
} from '../auth/passwords.js'
import { issuePasswordReset } from '../auth/password-reset.js'
import { endSession, startUserSession } from '../auth/session.js'
import { hashToken } from '../auth/tokens.js'
import { HttpError } from '../http/http-error.js'
import { definePublicRoute, defineUserRoute } from '../http/route.js'
import { invitationStatus } from '../invitations/invitations.js'
import { describeError, log } from '../logger.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import type { AppDependencies } from '../types/app.js'
import type {
  EmailChangeTokenModel,
  InvitationModel,
  PasswordResetTokenModel,
} from '../types/models.js'
import { createUserWithDefaults, toUserProfile } from '../users/users.js'

const tag = 'auth'

const invitationErrors = {
  404: errorResponse('Unknown, accepted or revoked invitation'),
  410: errorResponse('Expired invitation'),
  429: errorResponse('Too many failed attempts from this address'),
}

const tokenErrors = {
  404: errorResponse('Unknown or already used link'),
  410: errorResponse('Expired link'),
  429: errorResponse('Too many failed attempts from this address'),
}

async function findUsableInvitation(
  app: AppDependencies,
  token: string,
  ip: string,
): Promise<InvitationModel> {
  const invitation = await app.models.Invitation.findOne({
    where: { tokenHash: hashToken(token) },
  })
  const status =
    invitation === null ? null : invitationStatus(invitation, app.clock.now())
  if (invitation === null || status === 'accepted' || status === 'revoked') {
    recordIpFailure(app, ip)
    throw new HttpError({ status: 404, code: 'invitation_invalid' })
  }
  if (status === 'expired') {
    recordIpFailure(app, ip)
    throw new HttpError({ status: 410, code: 'invitation_expired' })
  }
  return invitation
}

async function findUsableToken<
  Record extends PasswordResetTokenModel | EmailChangeTokenModel,
>(
  app: AppDependencies,
  findByHash: (tokenHash: string) => Promise<Record | null>,
  token: string,
  ip: string,
): Promise<Record> {
  const record = await findByHash(hashToken(token))
  if (record === null || record.usedAt !== null) {
    recordIpFailure(app, ip)
    throw new HttpError({ status: 404, code: 'token_invalid' })
  }
  if (record.expiresAt.getTime() <= app.clock.now().getTime()) {
    recordIpFailure(app, ip)
    throw new HttpError({ status: 410, code: 'token_expired' })
  }
  return record
}

export const loginRoute = definePublicRoute({
  method: 'post',
  path: '/auth/login',
  summary: 'Log in with email and password',
  tag,
  body: loginRequestSchema,
  params: noParams,
  responses: {
    200: { description: 'Logged in', schema: userProfileSchema },
    400: errorResponse('Invalid request body'),
    401: errorResponse('Wrong email or password'),
    403: errorResponse('Disabled account'),
    429: errorResponse('Account or address temporarily locked'),
  },
  handle: async ({ request, app, body }) => {
    const ip = clientIp(request)
    ensureIpAllowed(app, ip)
    ensureAccountAllowed(app, body.email)
    const user = await app.models.User.findOne({ where: { email: body.email } })
    const valid =
      user === null
        ? await verifyAgainstDecoy(body.password)
        : await verifyPassword(user.passwordHash, body.password)
    if (user === null || !valid) {
      audit('login_failed', { email: accountKey(body.email), ip })
      recordIpFailure(app, ip)
      try {
        recordAccountFailure(app, body.email)
      } catch (error) {
        audit('login_blocked', { email: accountKey(body.email), ip })
        throw error
      }
      throw new HttpError({ status: 401, code: 'invalid_credentials' })
    }
    if (user.status !== 'active') {
      audit('login_refused_disabled', { userId: user.id, ip })
      throw new HttpError({ status: 403, code: 'account_disabled' })
    }
    app.limiters.account.reset(accountKey(body.email))
    await startUserSession(request, user)
    await user.update({ lastLoginAt: app.clock.now() })
    audit('login_succeeded', { userId: user.id, ip })
    return { status: 200, body: toUserProfile(user) }
  },
})

export const logoutRoute = definePublicRoute({
  method: 'post',
  path: '/auth/logout',
  summary: 'Log out the current session',
  tag,
  body: noBody,
  params: noParams,
  responses: { 204: { description: 'Logged out' } },
  handle: async ({ request, response, app }) => {
    const userId = request.session.userId
    if (userId !== undefined) {
      await endSession(request, response, app)
      audit('logout', { userId, ip: clientIp(request) })
    }
    return { status: 204 }
  },
})

export const sessionRoute = defineUserRoute({
  method: 'get',
  path: '/auth/session',
  summary: 'Return the profile of the logged in user',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Logged in user', schema: userProfileSchema },
    401: errorResponse('No valid session'),
  },
  handle: ({ user }) => ({ status: 200, body: toUserProfile(user) }),
})

export const checkInvitationRoute = definePublicRoute({
  method: 'post',
  path: '/auth/invitation/check',
  summary: 'Check an invitation link before showing the sign up form',
  tag,
  body: invitationTokenRequestSchema,
  params: noParams,
  responses: {
    200: {
      description: 'Usable invitation',
      schema: invitationStatusResponseSchema,
    },
    400: errorResponse('Malformed token'),
    ...invitationErrors,
  },
  handle: async ({ request, app, body }) => {
    const ip = clientIp(request)
    ensureIpAllowed(app, ip)
    const invitation = await findUsableInvitation(app, body.token, ip)
    return { status: 200, body: { email: invitation.email } }
  },
})

export const acceptInvitationRoute = definePublicRoute({
  method: 'post',
  path: '/auth/invitation/accept',
  summary: 'Create the account of an invitation and log it in',
  tag,
  body: acceptInvitationRequestSchema,
  params: noParams,
  responses: {
    201: {
      description: 'Account created and logged in',
      schema: userProfileSchema,
    },
    400: errorResponse('Invalid request body'),
    409: errorResponse('An account already uses this email'),
    ...invitationErrors,
  },
  handle: async ({ request, app, body }) => {
    const ip = clientIp(request)
    ensureIpAllowed(app, ip)
    const invitation = await findUsableInvitation(app, body.token, ip)
    const passwordHash = await hashPassword(body.password)
    const now = app.clock.now()
    const user = await app.sequelize.transaction(async (transaction) => {
      const locked = await app.models.Invitation.findByPk(invitation.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })
      if (locked === null || invitationStatus(locked, now) !== 'pending') {
        throw new HttpError({ status: 404, code: 'invitation_invalid' })
      }
      const existing = await app.models.User.findOne({
        where: { email: locked.email },
        transaction,
      })
      if (existing !== null) {
        throw new HttpError({ status: 409, code: 'email_taken' })
      }
      const created = await createUserWithDefaults(
        app.models,
        {
          email: locked.email,
          passwordHash,
          role: 'user',
          locale: body.locale,
        },
        transaction,
      )
      await locked.update({ acceptedAt: now }, { transaction })
      return created
    })
    await startUserSession(request, user)
    await user.update({ lastLoginAt: now })
    audit('invitation_accepted', {
      invitationId: invitation.id,
      userId: user.id,
    })
    return { status: 201, body: toUserProfile(user) }
  },
})

export const requestPasswordResetRoute = definePublicRoute({
  method: 'post',
  path: '/auth/password-reset/request',
  summary: 'Send a password reset link, same answer whether the email exists',
  tag,
  body: passwordResetRequestSchema,
  params: noParams,
  responses: {
    202: { description: 'Request accepted' },
    400: errorResponse('Invalid request body'),
    429: errorResponse('Too many requests from this address'),
  },
  handle: async ({ request, app, body }) => {
    const ip = clientIp(request)
    ensureIpAllowed(app, ip)
    recordIpFailure(app, ip)
    const user = await app.models.User.findOne({ where: { email: body.email } })
    audit('password_reset_requested', { ip, userId: user?.id ?? null })
    if (user !== null && user.status === 'active') {
      issuePasswordReset(app, user).catch((error: unknown) => {
        log('error', 'password_reset_mail_failed', {
          userId: user.id,
          error: describeError(error),
        })
      })
    }
    return { status: 202 }
  },
})

export const confirmPasswordResetRoute = definePublicRoute({
  method: 'post',
  path: '/auth/password-reset/confirm',
  summary: 'Set a new password from a reset link and revoke every session',
  tag,
  body: passwordResetConfirmRequestSchema,
  params: noParams,
  responses: {
    204: { description: 'Password changed' },
    400: errorResponse('Invalid request body'),
    ...tokenErrors,
  },
  handle: async ({ request, app, body }) => {
    const ip = clientIp(request)
    ensureIpAllowed(app, ip)
    const record = await findUsableToken(
      app,
      (tokenHash) =>
        app.models.PasswordResetToken.findOne({ where: { tokenHash } }),
      body.token,
      ip,
    )
    const user = await app.models.User.findByPk(record.userId)
    if (user === null || user.status !== 'active') {
      throw new HttpError({ status: 404, code: 'token_invalid' })
    }
    const passwordHash = await hashPassword(body.password)
    const now = app.clock.now()
    await app.sequelize.transaction(async (transaction) => {
      const [used] = await app.models.PasswordResetToken.update(
        { usedAt: now },
        { where: { id: record.id, usedAt: { [Op.is]: null } }, transaction },
      )
      if (used !== 1) {
        throw new HttpError({ status: 404, code: 'token_invalid' })
      }
      await user.update({ passwordHash }, { transaction })
      await app.models.Session.destroy({
        where: { userId: user.id },
        transaction,
      })
    })
    app.limiters.account.reset(accountKey(user.email))
    audit('password_reset_completed', { userId: user.id, ip })
    return { status: 204 }
  },
})

export const confirmEmailChangeRoute = definePublicRoute({
  method: 'post',
  path: '/auth/email-change/confirm',
  summary: 'Confirm a new email address from the link sent to it',
  tag,
  body: emailChangeConfirmRequestSchema,
  params: noParams,
  responses: {
    204: { description: 'Email changed' },
    400: errorResponse('Invalid request body'),
    409: errorResponse('An account already uses this email'),
    ...tokenErrors,
  },
  handle: async ({ request, app, body }) => {
    const ip = clientIp(request)
    ensureIpAllowed(app, ip)
    const record = await findUsableToken(
      app,
      (tokenHash) =>
        app.models.EmailChangeToken.findOne({ where: { tokenHash } }),
      body.token,
      ip,
    )
    const now = app.clock.now()
    try {
      await app.sequelize.transaction(async (transaction) => {
        const [used] = await app.models.EmailChangeToken.update(
          { usedAt: now },
          { where: { id: record.id, usedAt: { [Op.is]: null } }, transaction },
        )
        const user = await app.models.User.findByPk(record.userId, {
          transaction,
        })
        if (used !== 1 || user === null) {
          throw new HttpError({ status: 404, code: 'token_invalid' })
        }
        await user.update({ email: record.newEmail }, { transaction })
      })
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw new HttpError({ status: 409, code: 'email_taken' }, error)
      }
      throw error
    }
    audit('email_changed', { userId: record.userId, ip })
    return { status: 204 }
  },
})
