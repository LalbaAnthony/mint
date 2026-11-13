import type {
  AdminInvitation,
  InvitationStatus,
} from '@mint/shared/types/admin'
import { addMilliseconds, generateToken } from '../auth/tokens.js'
import { HttpError } from '../http/http-error.js'
import { buildLink, invitationMessage } from '../mail/messages.js'
import type { AppDependencies } from '../types/app.js'
import type { InvitationModel } from '../types/models.js'

export const invitationValidityMs = 7 * 24 * 60 * 60 * 1000

export function invitationStatus(
  invitation: InvitationModel,
  now: Date,
): InvitationStatus {
  if (invitation.acceptedAt !== null) {
    return 'accepted'
  }
  if (invitation.revokedAt !== null) {
    return 'revoked'
  }
  return invitation.expiresAt.getTime() <= now.getTime() ? 'expired' : 'pending'
}

export function toAdminInvitation(
  invitation: InvitationModel,
  now: Date,
): AdminInvitation {
  return {
    id: invitation.id,
    email: invitation.email,
    status: invitationStatus(invitation, now),
    createdAt: invitation.createdAt.toISOString(),
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    revokedAt: invitation.revokedAt?.toISOString() ?? null,
  }
}

export function isReusable(status: InvitationStatus): boolean {
  return status === 'pending' || status === 'expired'
}

export async function ensureEmailNotRegistered(
  app: AppDependencies,
  email: string,
): Promise<void> {
  const existing = await app.models.User.findOne({ where: { email } })
  if (existing !== null) {
    throw new HttpError({ status: 409, code: 'email_taken' })
  }
}

export async function sendInvitation(
  app: AppDependencies,
  email: string,
  token: string,
): Promise<void> {
  const link = buildLink(app.config.appOrigin, '/invitation', token)
  try {
    await app.mailer.send(invitationMessage(email, link))
  } catch (error) {
    throw new HttpError({ status: 502, code: 'mail_delivery_failed' }, error)
  }
}

export async function createInvitation(
  app: AppDependencies,
  email: string,
  invitedBy: string,
): Promise<InvitationModel> {
  const now = app.clock.now()
  const { token, tokenHash } = generateToken()
  return app.sequelize.transaction(async (transaction) => {
    const invitation = await app.models.Invitation.create(
      {
        email,
        tokenHash,
        invitedBy,
        expiresAt: addMilliseconds(now, invitationValidityMs),
      },
      { transaction },
    )
    await sendInvitation(app, email, token)
    return invitation
  })
}

export async function renewInvitation(
  app: AppDependencies,
  invitation: InvitationModel,
): Promise<InvitationModel> {
  const now = app.clock.now()
  const { token, tokenHash } = generateToken()
  return app.sequelize.transaction(async (transaction) => {
    await invitation.update(
      { tokenHash, expiresAt: addMilliseconds(now, invitationValidityMs) },
      { transaction },
    )
    await sendInvitation(app, invitation.email, token)
    return invitation
  })
}
