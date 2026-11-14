import { z } from 'zod'
import {
  accountNatureSchema,
  accountUsageSchema,
  regulatedProductIssue,
  regulatedProductSchema,
} from '@mint/shared/schemas/accounts'
import {
  amountCentsSchema,
  isoDateSchema,
  labelSchema,
} from '@mint/shared/schemas/common'
import {
  currentPasswordSchema,
  localeSchema,
  newPasswordSchema,
} from '@mint/shared/schemas/user'
import { parseAmountInput } from '../app/utils/money'

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

const amountInputSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, { error: 'required' })
  .transform((text, context) => {
    const cents = parseAmountInput(text)
    if (cents === null) {
      context.addIssue({ code: 'custom', message: 'invalid_amount' })
      return z.NEVER
    }
    return cents
  })
  .pipe(amountCentsSchema)

const optionalAmountInputSchema = z
  .string({ error: 'invalid_amount' })
  .trim()
  .transform((text, context) => {
    if (text === '') {
      return null
    }
    const cents = parseAmountInput(text)
    if (cents === null) {
      context.addIssue({ code: 'custom', message: 'invalid_amount' })
      return z.NEVER
    }
    return cents
  })
  .pipe(amountCentsSchema.nullable())

const optionalLabelInputSchema = z
  .string({ error: 'invalid' })
  .trim()
  .transform((text) => (text === '' ? null : text))
  .pipe(labelSchema.nullable())

export function accountFormSchema(today: string) {
  return z
    .object({
      name: labelSchema,
      nature: accountNatureSchema,
      regulatedProduct: regulatedProductSchema.nullable(),
      usage: accountUsageSchema,
      institution: optionalLabelInputSchema,
      initialBalance: amountInputSchema,
      initialBalanceDate: isoDateSchema.refine((date) => date <= today, {
        error: 'date_in_future',
      }),
      lowBalanceThreshold: optionalAmountInputSchema,
    })
    .superRefine((account, context) => {
      const issue = regulatedProductIssue(account)
      if (issue !== null) {
        context.addIssue({
          code: 'custom',
          message: issue,
          path: ['regulatedProduct'],
        })
      }
    })
}
