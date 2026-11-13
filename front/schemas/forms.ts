import { z } from 'zod'
import {
  currentPasswordSchema,
  localeSchema,
  newPasswordSchema,
} from '@mint/shared/schemas/user'

function confirms(state: { password: string; confirmation: string }): boolean {
  return state.password === state.confirmation
}

const confirmationIssue = {
  error: 'passwords_differ',
  path: ['confirmation'],
}

export const newPasswordFormSchema = z
  .object({ password: newPasswordSchema, confirmation: z.string() })
  .refine(confirms, confirmationIssue)

export const acceptInvitationFormSchema = z
  .object({
    password: newPasswordSchema,
    confirmation: z.string(),
    locale: localeSchema,
  })
  .refine(confirms, confirmationIssue)

export const changePasswordFormSchema = z
  .object({
    currentPassword: currentPasswordSchema,
    password: newPasswordSchema,
    confirmation: z.string(),
  })
  .refine(confirms, confirmationIssue)
