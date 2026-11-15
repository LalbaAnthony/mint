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
import { noteMaxLength } from '@mint/shared/schemas/operations'
import { rulePatternMaxLength } from '@mint/shared/schemas/rules'
import { maxScheduleInterval } from '@mint/shared/schemas/schedules'
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

const positiveAmountInputSchema = amountInputSchema.refine(
  (cents) => cents > 0,
  { error: 'amount_not_positive' },
)

const noteInputSchema = z
  .string({ error: 'invalid' })
  .trim()
  .max(noteMaxLength, { error: 'too_long' })

const requiredChoiceSchema = z
  .string({ error: 'required' })
  .min(1, { error: 'required' })

export const operationFormSchema = z.object({
  source: requiredChoiceSchema,
  date: isoDateSchema,
  amount: positiveAmountInputSchema,
  label: labelSchema,
  note: noteInputSchema,
})

export const transferFormSchema = z
  .object({
    sourceAccountId: requiredChoiceSchema,
    targetAccountId: requiredChoiceSchema,
    date: isoDateSchema,
    amount: positiveAmountInputSchema,
    label: labelSchema,
    note: noteInputSchema,
  })
  .refine((transfer) => transfer.sourceAccountId !== transfer.targetAccountId, {
    error: 'same_account',
    path: ['targetAccountId'],
  })

export const occurrenceFormSchema = z
  .object({
    amount: z.string({ error: 'invalid_amount' }).trim(),
    effectiveDate: z.string({ error: 'invalid_date' }).trim(),
  })
  .superRefine((occurrence, context) => {
    if (occurrence.amount === '' && occurrence.effectiveDate === '') {
      context.addIssue({
        code: 'custom',
        message: 'override_empty',
        path: ['amount'],
      })
    }
    if (occurrence.amount !== '') {
      const cents = parseAmountInput(occurrence.amount)
      if (cents === null || cents <= 0) {
        context.addIssue({
          code: 'custom',
          message: 'amount_not_positive',
          path: ['amount'],
        })
      }
    }
  })

export const envelopeFormSchema = z.object({
  label: labelSchema,
  amount: positiveAmountInputSchema,
  source: requiredChoiceSchema,
  categoryIds: z
    .array(z.string(), { error: 'required' })
    .min(1, { error: 'required' }),
})

export const scheduleFormSchema = z.object({
  label: labelSchema,
  amount: positiveAmountInputSchema,
  interval: z
    .number({ error: 'invalid' })
    .int({ error: 'invalid' })
    .min(1, { error: 'interval_out_of_range' })
    .max(maxScheduleInterval, { error: 'interval_out_of_range' }),
  startDate: isoDateSchema,
  note: noteInputSchema,
})

export const ruleFormSchema = z
  .object({
    pattern: z
      .string({ error: 'required' })
      .trim()
      .min(1, { error: 'required' })
      .max(rulePatternMaxLength, { error: 'too_long' }),
    amountMin: optionalAmountInputSchema,
    amountMax: optionalAmountInputSchema,
    action: z.enum(['category', 'transfer']),
    categoryId: z.string().optional(),
    transferAccountId: z.string().optional(),
  })
  .refine(
    (rule) =>
      rule.action === 'category'
        ? rule.categoryId !== undefined
        : rule.transferAccountId !== undefined,
    { error: 'required', path: ['categoryId'] },
  )

export const importFileFormSchema = z.object({
  accountId: z.string({ error: 'required' }).min(1, { error: 'required' }),
})

export const statementFormSchema = z.object({
  date: isoDateSchema,
  balance: amountInputSchema,
})
