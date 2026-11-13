import {
  adminInvitationListResponseSchema,
  adminInvitationSchema,
  adminUserListResponseSchema,
  adminUserSchema,
  createInvitationRequestSchema,
  resourceIdParamsSchema,
} from '@mint/shared/schemas/admin'
import { audit } from '../audit.js'
import { issuePasswordReset } from '../auth/password-reset.js'
import { revokeUserSessions } from '../auth/session.js'
import { HttpError, notFound } from '../http/http-error.js'
import { defineAdminRoute } from '../http/route.js'
import {
  createInvitation,
  ensureEmailNotRegistered,
  invitationStatus,
  isReusable,
  renewInvitation,
  toAdminInvitation,
} from '../invitations/invitations.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import type { AppDependencies } from '../types/app.js'
import type { InvitationModel, UserModel } from '../types/models.js'
import { toAdminUser } from '../users/users.js'

const tag = 'administration'

const accessErrors = {
  401: errorResponse('No valid session'),
  403: errorResponse('The user is not an administrator'),
}

const resourceErrors = {
  ...accessErrors,
  404: errorResponse('Unknown resource'),
}

async function findInvitation(
  app: AppDependencies,
  id: string,
): Promise<InvitationModel> {
  const invitation = await app.models.Invitation.findByPk(id)
  if (invitation === null) {
    throw notFound()
  }
  return invitation
}

async function findUser(app: AppDependencies, id: string): Promise<UserModel> {
  const user = await app.models.User.findByPk(id)
  if (user === null) {
    throw notFound()
  }
  return user
}

export const listInvitationsRoute = defineAdminRoute({
  method: 'get',
  path: '/admin/invitations',
  summary: 'List every invitation with its status',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'Invitations',
      schema: adminInvitationListResponseSchema,
    },
    ...accessErrors,
  },
  handle: async ({ app }) => {
    const now = app.clock.now()
    const invitations = await app.models.Invitation.findAll({
      order: [['createdAt', 'DESC']],
    })
    return {
      status: 200,
      body: invitations.map((invitation) => toAdminInvitation(invitation, now)),
    }
  },
})

export const createInvitationRoute = defineAdminRoute({
  method: 'post',
  path: '/admin/invitations',
  summary: 'Invite someone by email',
  tag,
  body: createInvitationRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Invitation sent', schema: adminInvitationSchema },
    400: errorResponse('Invalid request body'),
    ...accessErrors,
    409: errorResponse('Email already registered or already invited'),
    502: errorResponse('The invitation email could not be sent'),
  },
  handle: async ({ app, user, body }) => {
    await ensureEmailNotRegistered(app, body.email)
    const now = app.clock.now()
    const previous = await app.models.Invitation.findAll({
      where: { email: body.email },
    })
    if (
      previous.some(
        (invitation) => invitationStatus(invitation, now) === 'pending',
      )
    ) {
      throw new HttpError({ status: 409, code: 'invitation_pending' })
    }
    const invitation = await createInvitation(app, body.email, user.id)
    audit('invitation_created', {
      invitationId: invitation.id,
      adminId: user.id,
    })
    return { status: 201, body: toAdminInvitation(invitation, now) }
  },
})

export const resendInvitationRoute = defineAdminRoute({
  method: 'post',
  path: '/admin/invitations/:id/resend',
  summary: 'Send a new link and invalidate the previous one',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: {
      description: 'Invitation sent again',
      schema: adminInvitationSchema,
    },
    ...resourceErrors,
    409: errorResponse('Accepted or revoked invitation, or email registered'),
    502: errorResponse('The invitation email could not be sent'),
  },
  handle: async ({ app, user, params }) => {
    const invitation = await findInvitation(app, params.id)
    if (!isReusable(invitationStatus(invitation, app.clock.now()))) {
      throw new HttpError({ status: 409, code: 'invitation_not_resendable' })
    }
    await ensureEmailNotRegistered(app, invitation.email)
    const renewed = await renewInvitation(app, invitation)
    audit('invitation_resent', { invitationId: renewed.id, adminId: user.id })
    return { status: 200, body: toAdminInvitation(renewed, app.clock.now()) }
  },
})

export const revokeInvitationRoute = defineAdminRoute({
  method: 'post',
  path: '/admin/invitations/:id/revoke',
  summary: 'Revoke an invitation that was not accepted',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Invitation revoked', schema: adminInvitationSchema },
    ...resourceErrors,
    409: errorResponse('Accepted or already revoked invitation'),
  },
  handle: async ({ app, user, params }) => {
    const invitation = await findInvitation(app, params.id)
    const now = app.clock.now()
    if (!isReusable(invitationStatus(invitation, now))) {
      throw new HttpError({ status: 409, code: 'invitation_not_revocable' })
    }
    await invitation.update({ revokedAt: now })
    audit('invitation_revoked', {
      invitationId: invitation.id,
      adminId: user.id,
    })
    return { status: 200, body: toAdminInvitation(invitation, now) }
  },
})

export const listUsersRoute = defineAdminRoute({
  method: 'get',
  path: '/admin/users',
  summary: 'List users without any financial data',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Users', schema: adminUserListResponseSchema },
    ...accessErrors,
  },
  handle: async ({ app }) => {
    const users = await app.models.User.findAll({
      order: [['createdAt', 'ASC']],
    })
    return { status: 200, body: users.map(toAdminUser) }
  },
})

export const disableUserRoute = defineAdminRoute({
  method: 'post',
  path: '/admin/users/:id/disable',
  summary: 'Disable a user and revoke its sessions, data kept',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'User disabled', schema: adminUserSchema },
    ...resourceErrors,
    409: errorResponse('An administrator cannot disable itself'),
  },
  handle: async ({ app, user, params }) => {
    const target = await findUser(app, params.id)
    if (target.id === user.id) {
      throw new HttpError({ status: 409, code: 'cannot_disable_self' })
    }
    await target.update({ status: 'disabled' })
    await revokeUserSessions(app, target.id)
    audit('user_disabled', { userId: target.id, adminId: user.id })
    return { status: 200, body: toAdminUser(target) }
  },
})

export const enableUserRoute = defineAdminRoute({
  method: 'post',
  path: '/admin/users/:id/enable',
  summary: 'Enable a disabled user',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'User enabled', schema: adminUserSchema },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    const target = await findUser(app, params.id)
    await target.update({ status: 'active' })
    audit('user_enabled', { userId: target.id, adminId: user.id })
    return { status: 200, body: toAdminUser(target) }
  },
})

export const sendPasswordResetRoute = defineAdminRoute({
  method: 'post',
  path: '/admin/users/:id/password-reset',
  summary: 'Send a password reset link to a user',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    202: { description: 'Reset link sent' },
    ...resourceErrors,
    409: errorResponse('Disabled user'),
    502: errorResponse('The reset email could not be sent'),
  },
  handle: async ({ app, user, params }) => {
    const target = await findUser(app, params.id)
    if (target.status !== 'active') {
      throw new HttpError({ status: 409, code: 'user_disabled' })
    }
    await issuePasswordReset(app, target)
    audit('user_password_reset_sent', { userId: target.id, adminId: user.id })
    return { status: 202 }
  },
})
