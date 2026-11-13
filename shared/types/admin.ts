import type { z } from 'zod'
import type {
  adminInvitationSchema,
  adminUserSchema,
  createInvitationRequestSchema,
  invitationStatusSchema,
  resourceIdParamsSchema,
} from '../schemas/admin.js'

export type ResourceIdParams = z.infer<typeof resourceIdParamsSchema>

export type CreateInvitationRequest = z.infer<
  typeof createInvitationRequestSchema
>

export type InvitationStatus = z.infer<typeof invitationStatusSchema>

export type AdminInvitation = z.infer<typeof adminInvitationSchema>

export type AdminUser = z.infer<typeof adminUserSchema>
