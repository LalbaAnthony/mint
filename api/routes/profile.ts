import { Op } from 'sequelize'
import {
  changePasswordRequestSchema,
  emailChangeRequestSchema,
  sessionListResponseSchema,
  updateProfileRequestSchema,
} from '@mint/shared/schemas/profile'
import { userProfileSchema } from '@mint/shared/schemas/user'
import { audit } from '../audit.js'
import { issueEmailChange } from '../auth/email-change.js'
import { confirmCurrentPassword } from '../auth/password-confirmation.js'
import { hashPassword } from '../auth/passwords.js'
import { endSession, revokeUserSessions } from '../auth/session.js'
import { HttpError } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import { toUserProfile } from '../users/users.js'

const tag = 'profile'

export const updateProfileRoute = defineUserRoute({
  method: 'patch',
  path: '/profile',
  summary:
    'Update language, theme (NF-UX-02), forecast horizon and allocation targets',
  tag,
  body: updateProfileRequestSchema,
  params: noParams,
  responses: {
    200: { description: 'Updated profile', schema: userProfileSchema },
    400: errorResponse('Invalid request body'),
    401: errorResponse('No valid session'),
  },
  handle: async ({ user, body }) => {
    await user.update({
      ...(body.locale === undefined ? {} : { locale: body.locale }),
      ...(body.theme === undefined ? {} : { theme: body.theme }),
      ...(body.forecastHorizonMonths === undefined
        ? {}
        : { forecastHorizonMonths: body.forecastHorizonMonths }),
      ...(body.targets === undefined
        ? {}
        : {
            targetNeedsPct: body.targets.needs,
            targetWantsPct: body.targets.wants,
            targetSavePct: body.targets.save,
          }),
    })
    return { status: 200, body: toUserProfile(user) }
  },
})

export const changePasswordRoute = defineUserRoute({
  method: 'post',
  path: '/profile/password',
  summary: 'Change the password and revoke every session, this one included',
  tag,
  body: changePasswordRequestSchema,
  params: noParams,
  responses: {
    204: { description: 'Password changed, logged out everywhere' },
    400: errorResponse('Invalid body or wrong current password'),
    401: errorResponse('No valid session'),
    429: errorResponse('Account temporarily locked'),
  },
  handle: async ({ request, response, app, user, body }) => {
    await confirmCurrentPassword(app, user, body.currentPassword)
    const passwordHash = await hashPassword(body.newPassword)
    await user.update({ passwordHash })
    await revokeUserSessions(app, user.id)
    await endSession(request, response, app)
    audit('password_changed', { userId: user.id })
    return { status: 204 }
  },
})

export const requestEmailChangeRoute = defineUserRoute({
  method: 'post',
  path: '/profile/email',
  summary: 'Send a confirmation link to the new email address',
  tag,
  body: emailChangeRequestSchema,
  params: noParams,
  responses: {
    202: { description: 'Confirmation link sent to the new address' },
    400: errorResponse('Invalid body or wrong current password'),
    401: errorResponse('No valid session'),
    409: errorResponse('An account already uses this email'),
    429: errorResponse('Account temporarily locked'),
    502: errorResponse('The confirmation email could not be sent'),
  },
  handle: async ({ app, user, body }) => {
    await confirmCurrentPassword(app, user, body.password)
    const taken = await app.models.User.findOne({
      where: { email: body.newEmail },
    })
    if (taken !== null) {
      throw new HttpError({ status: 409, code: 'email_taken' })
    }
    await issueEmailChange(app, user, body.newEmail)
    audit('email_change_requested', { userId: user.id })
    return { status: 202 }
  },
})

export const listSessionsRoute = defineUserRoute({
  method: 'get',
  path: '/profile/sessions',
  summary: 'List the active sessions of the logged in user',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Active sessions', schema: sessionListResponseSchema },
    401: errorResponse('No valid session'),
  },
  handle: async ({ request, app, user }) => {
    const sessions = await app.models.Session.findAll({
      where: { userId: user.id, expiresAt: { [Op.gt]: app.clock.now() } },
      order: [['lastSeenAt', 'DESC']],
    })
    return {
      status: 200,
      body: sessions.map((session) => ({
        id: session.id,
        createdAt: session.createdAt.toISOString(),
        lastSeenAt: session.lastSeenAt.toISOString(),
        userAgent: session.userAgent,
        ip: session.ip,
        current: session.sid === request.sessionID,
      })),
    }
  },
})

export const revokeSessionsRoute = defineUserRoute({
  method: 'delete',
  path: '/profile/sessions',
  summary: 'Log out every session of the user, this one included',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    204: { description: 'Logged out everywhere' },
    401: errorResponse('No valid session'),
  },
  handle: async ({ request, response, app, user }) => {
    const revoked = await revokeUserSessions(app, user.id)
    await endSession(request, response, app)
    audit('sessions_revoked', { userId: user.id, count: revoked })
    return { status: 204 }
  },
})
