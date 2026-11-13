import { z } from 'zod'

export const apiErrorCodes = [
  'validation_failed',
  'unauthenticated',
  'forbidden',
  'not_found',
  'csrf_invalid',
  'invalid_credentials',
  'account_locked',
  'too_many_attempts',
  'account_disabled',
  'invitation_invalid',
  'invitation_expired',
  'token_invalid',
  'token_expired',
  'email_taken',
  'invitation_pending',
  'invitation_not_resendable',
  'invitation_not_revocable',
  'cannot_disable_self',
  'user_disabled',
  'mail_delivery_failed',
  'internal_error',
] as const

export const apiErrorCodeSchema = z.enum(apiErrorCodes)

export const validationIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
})

export const apiErrorResponseSchema = z
  .object({
    error: z.string(),
    issues: z.array(validationIssueSchema).optional(),
    retryAfterSeconds: z.number().int().optional(),
  })
  .meta({ id: 'ApiError' })
