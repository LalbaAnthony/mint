import { z } from 'zod'
import {
  currentPasswordSchema,
  emailSchema,
  localeSchema,
  newPasswordSchema,
} from './user.js'

export const tokenSchema = z
  .string({ error: 'invalid_token' })
  .regex(/^[A-Za-z0-9_-]{16,128}$/, { error: 'invalid_token' })

export const csrfTokenResponseSchema = z
  .object({ token: z.string() })
  .meta({ id: 'CsrfTokenResponse' })

export const loginRequestSchema = z
  .object({ email: emailSchema, password: currentPasswordSchema })
  .meta({ id: 'LoginRequest' })

export const invitationTokenRequestSchema = z
  .object({ token: tokenSchema })
  .meta({ id: 'InvitationTokenRequest' })

export const invitationStatusResponseSchema = z
  .object({ email: emailSchema })
  .meta({ id: 'InvitationStatusResponse' })

export const acceptInvitationRequestSchema = z
  .object({
    token: tokenSchema,
    password: newPasswordSchema,
    locale: localeSchema,
  })
  .meta({ id: 'AcceptInvitationRequest' })

export const passwordResetRequestSchema = z
  .object({ email: emailSchema })
  .meta({ id: 'PasswordResetRequest' })

export const passwordResetConfirmRequestSchema = z
  .object({ token: tokenSchema, password: newPasswordSchema })
  .meta({ id: 'PasswordResetConfirmRequest' })

export const emailChangeConfirmRequestSchema = z
  .object({ token: tokenSchema })
  .meta({ id: 'EmailChangeConfirmRequest' })
