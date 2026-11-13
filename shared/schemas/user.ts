import { z } from 'zod'

export const passwordMinLength = 12
export const passwordMaxLength = 256
export const emailMaxLength = 254
export const forecastHorizonMinMonths = 1
export const forecastHorizonMaxMonths = 12

export const localeSchema = z
  .enum(['fr', 'en'], { error: 'invalid_locale' })
  .meta({ id: 'Locale' })

export const userRoleSchema = z.enum(['admin', 'user']).meta({ id: 'UserRole' })

export const userStatusSchema = z
  .enum(['active', 'disabled'])
  .meta({ id: 'UserStatus' })

export const emailSchema = z
  .email({ error: 'invalid_email' })
  .max(emailMaxLength, { error: 'too_long' })

export const newPasswordSchema = z
  .string({ error: 'required' })
  .min(passwordMinLength, { error: 'password_too_short' })
  .max(passwordMaxLength, { error: 'too_long' })

export const currentPasswordSchema = z
  .string({ error: 'required' })
  .min(1, { error: 'required' })
  .max(passwordMaxLength, { error: 'too_long' })

export const forecastHorizonSchema = z
  .number({ error: 'horizon_out_of_range' })
  .int({ error: 'horizon_out_of_range' })
  .min(forecastHorizonMinMonths, { error: 'horizon_out_of_range' })
  .max(forecastHorizonMaxMonths, { error: 'horizon_out_of_range' })

const percentageSchema = z
  .number({ error: 'percentage_out_of_range' })
  .int({ error: 'percentage_out_of_range' })
  .min(0, { error: 'percentage_out_of_range' })
  .max(100, { error: 'percentage_out_of_range' })

export const allocationTargetsSchema = z
  .object({
    needs: percentageSchema,
    wants: percentageSchema,
    save: percentageSchema,
  })
  .refine((targets) => targets.needs + targets.wants + targets.save === 100, {
    error: 'targets_sum_not_100',
  })
  .meta({ id: 'AllocationTargets' })

export const userProfileSchema = z
  .object({
    id: z.uuid(),
    email: emailSchema,
    role: userRoleSchema,
    locale: localeSchema,
    forecastHorizonMonths: forecastHorizonSchema,
    targets: allocationTargetsSchema,
  })
  .meta({ id: 'UserProfile' })
