import { z } from 'zod'
import {
  emailSchema,
  localeSchema,
  userRoleSchema,
  userStatusSchema,
} from './user.js'

export const resourceIdParamsSchema = z.object({ id: z.uuid() })

export const createInvitationRequestSchema = z
  .object({ email: emailSchema })
  .meta({ id: 'CreateInvitationRequest' })

export const invitationStatusSchema = z
  .enum(['pending', 'accepted', 'expired', 'revoked'])
  .meta({ id: 'InvitationStatus' })

export const adminInvitationSchema = z
  .object({
    id: z.uuid(),
    email: emailSchema,
    status: invitationStatusSchema,
    createdAt: z.iso.datetime(),
    expiresAt: z.iso.datetime(),
    acceptedAt: z.iso.datetime().nullable(),
    revokedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'AdminInvitation' })

export const adminInvitationListResponseSchema = z
  .array(adminInvitationSchema)
  .meta({ id: 'AdminInvitationListResponse' })

export const adminUserSchema = z
  .object({
    id: z.uuid(),
    email: emailSchema,
    role: userRoleSchema,
    locale: localeSchema,
    status: userStatusSchema,
    createdAt: z.iso.datetime(),
    lastLoginAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'AdminUser' })

export const adminUserListResponseSchema = z
  .array(adminUserSchema)
  .meta({ id: 'AdminUserListResponse' })
