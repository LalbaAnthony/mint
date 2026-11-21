import { z } from 'zod'
import { passkeyAuthenticationResponseSchema } from './passkeys.js'
import {
  allocationTargetsSchema,
  currentPasswordSchema,
  defaultAccountIdSchema,
  emailSchema,
  forecastHorizonSchema,
  localeSchema,
  newPasswordSchema,
  themePreferenceSchema,
} from './user.js'

export const updateProfileRequestSchema = z
  .object({
    locale: localeSchema.optional(),
    theme: themePreferenceSchema.optional(),
    forecastHorizonMonths: forecastHorizonSchema.optional(),
    targets: allocationTargetsSchema.optional(),
    defaultAccountId: defaultAccountIdSchema.optional(),
  })
  .meta({ id: 'UpdateProfileRequest' })

export const changePasswordRequestSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    newPassword: newPasswordSchema,
  })
  .meta({ id: 'ChangePasswordRequest' })

export const emailChangeRequestSchema = z
  .object({ newEmail: emailSchema, password: currentPasswordSchema })
  .meta({ id: 'EmailChangeRequest' })

export const sessionSummarySchema = z
  .object({
    id: z.uuid(),
    createdAt: z.iso.datetime(),
    lastSeenAt: z.iso.datetime(),
    userAgent: z.string().nullable(),
    ip: z.string().nullable(),
    current: z.boolean(),
  })
  .meta({ id: 'SessionSummary' })

export const sessionListResponseSchema = z
  .array(sessionSummarySchema)
  .meta({ id: 'SessionListResponse' })

export const exportRequestSchema = z
  .object({ password: currentPasswordSchema })
  .meta({ id: 'ExportRequest' })

export const accountDeletionRequestSchema = z
  .discriminatedUnion('method', [
    z.object({
      method: z.literal('password'),
      email: emailSchema,
      password: currentPasswordSchema,
    }),
    z.object({
      method: z.literal('passkey'),
      email: emailSchema,
      response: passkeyAuthenticationResponseSchema,
    }),
  ])
  .meta({ id: 'AccountDeletionRequest' })
