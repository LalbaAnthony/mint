import type { z } from 'zod'
import type {
  acceptInvitationRequestSchema,
  csrfTokenResponseSchema,
  emailChangeConfirmRequestSchema,
  invitationStatusResponseSchema,
  invitationTokenRequestSchema,
  loginRequestSchema,
  passwordResetConfirmRequestSchema,
  passwordResetRequestSchema,
} from '../schemas/auth.js'

export type CsrfTokenResponse = z.infer<typeof csrfTokenResponseSchema>

export type LoginRequest = z.infer<typeof loginRequestSchema>

export type InvitationTokenRequest = z.infer<
  typeof invitationTokenRequestSchema
>

export type InvitationStatusResponse = z.infer<
  typeof invitationStatusResponseSchema
>

export type AcceptInvitationRequest = z.infer<
  typeof acceptInvitationRequestSchema
>

export type PasswordResetRequest = z.infer<typeof passwordResetRequestSchema>

export type PasswordResetConfirmRequest = z.infer<
  typeof passwordResetConfirmRequestSchema
>

export type EmailChangeConfirmRequest = z.infer<
  typeof emailChangeConfirmRequestSchema
>
