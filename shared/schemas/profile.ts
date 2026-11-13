import { z } from 'zod'
import {
  allocationTargetsSchema,
  currentPasswordSchema,
  emailSchema,
  forecastHorizonSchema,
  localeSchema,
  newPasswordSchema,
} from './user.js'

export const updateProfileRequestSchema = z
  .object({
    locale: localeSchema.optional(),
    forecastHorizonMonths: forecastHorizonSchema.optional(),
    targets: allocationTargetsSchema.optional(),
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
