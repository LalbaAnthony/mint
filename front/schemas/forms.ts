import { z } from 'zod'
import {
  accountNatureSchema,
  accountUsageSchema,
  isSavingsNature,
  regulatedProductIssue,
  regulatedProductSchema,
} from '@mint/shared/schemas/accounts'
import {
  annualRatePctSchema,
  capitalizationSchema,
  interestMethodSchema,
} from '@mint/shared/schemas/interest'
import {
  amountCentsSchema,
  isoDateSchema,
  labelSchema,
} from '@mint/shared/schemas/common'
import { noteMaxLength } from '@mint/shared/schemas/operations'
import { passkeyNameSchema } from '@mint/shared/schemas/passkeys'
import { updateProfileRequestSchema } from '@mint/shared/schemas/profile'
import { rulePatternMaxLength } from '@mint/shared/schemas/rules'
import { maxScheduleInterval } from '@mint/shared/schemas/schedules'
import {
  currentPasswordSchema,
  defaultAccountIdSchema,
  emailSchema,
  localeSchema,
  newPasswordSchema,
} from '@mint/shared/schemas/user'
import { parseAmountInput, parseRateInput } from '../app/utils/money'

export const noDefaultAccount = 'none'

export const profileFormSchema = updateProfileRequestSchema.extend({
  defaultAccountId: z
    .string()
    .transform((id) => (id === noDefaultAccount ? null : id))
    .pipe(defaultAccountIdSchema),
})

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

function amountInputSchema(locale: string) {
  return z
    .string({ error: 'required' })
    .trim()
    .min(1, { error: 'required' })
    .transform((text, context) => {
      const cents = parseAmountInput(text, locale)
      if (cents === null) {
        context.addIssue({ code: 'custom', message: 'invalid_amount' })
        return z.NEVER
      }
      return cents
    })
    .pipe(amountCentsSchema)
}

function optionalAmountInputSchema(locale: string) {
  return z
    .string({ error: 'invalid_amount' })
    .trim()
    .transform((text, context) => {
      if (text === '') {
        return null
      }
      const cents = parseAmountInput(text, locale)
      if (cents === null) {
        context.addIssue({ code: 'custom', message: 'invalid_amount' })
        return z.NEVER
      }
      return cents
    })
    .pipe(amountCentsSchema.nullable())
}

const optionalLabelInputSchema = z
  .string({ error: 'invalid' })
  .trim()
  .transform((text) => (text === '' ? null : text))
  .pipe(labelSchema.nullable())

function optionalPositiveAmountInputSchema(locale: string) {
  return optionalAmountInputSchema(locale).refine(
    (cents) => cents === null || cents > 0,
    { error: 'amount_not_positive' },
  )
}

const optionalDateInputSchema = z
  .string({ error: 'invalid_date' })
  .trim()
  .transform((text) => (text === '' ? null : text))
  .pipe(isoDateSchema.nullable())

export function accountFormSchema(today: string, locale: string) {
  return z
    .object({
      name: labelSchema,
      nature: accountNatureSchema,
      regulatedProduct: regulatedProductSchema.nullable(),
      usage: accountUsageSchema,
      institution: optionalLabelInputSchema,
      initialBalance: amountInputSchema(locale),
      initialBalanceDate: isoDateSchema.refine((date) => date <= today, {
        error: 'date_in_future',
      }),
      lowBalanceThreshold: optionalAmountInputSchema(locale),
      depositCap: optionalPositiveAmountInputSchema(locale),
      capitalizedInterest: optionalAmountInputSchema(locale).refine(
        (cents) => cents === null || cents >= 0,
        { error: 'amount_out_of_range' },
      ),
      interestMethod: interestMethodSchema,
      capitalization: capitalizationSchema,
      anniversaryDate: optionalDateInputSchema,
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
      if (
        isSavingsNature(account.nature) &&
        account.capitalization === 'anniversary' &&
        account.anniversaryDate === null
      ) {
        context.addIssue({
          code: 'custom',
          message: 'required',
          path: ['anniversaryDate'],
        })
      }
    })
}

export function interestRateFormSchema(locale: string) {
  return z.object({
    effectiveDate: isoDateSchema,
    rate: z
      .string({ error: 'required' })
      .trim()
      .min(1, { error: 'required' })
      .transform((text, context) => {
        const rate = parseRateInput(text, locale)
        if (rate === null) {
          context.addIssue({ code: 'custom', message: 'invalid_rate' })
          return z.NEVER
        }
        return rate
      })
      .pipe(annualRatePctSchema),
  })
}

export function regulatedCapFormSchema(locale: string) {
  return z.object({
    cap: optionalPositiveAmountInputSchema(locale).refine(
      (cents) => cents !== null,
      { error: 'required' },
    ),
  })
}

function positiveAmountInputSchema(locale: string) {
  return amountInputSchema(locale).refine((cents) => cents > 0, {
    error: 'amount_not_positive',
  })
}

const noteInputSchema = z
  .string({ error: 'invalid' })
  .trim()
  .max(noteMaxLength, { error: 'too_long' })

const requiredChoiceSchema = z
  .string({ error: 'required' })
  .min(1, { error: 'required' })

export function operationFormSchema(locale: string) {
  return z.object({
    source: requiredChoiceSchema,
    date: isoDateSchema,
    amount: positiveAmountInputSchema(locale),
    label: labelSchema,
    note: noteInputSchema,
  })
}

export function transferFormSchema(locale: string) {
  return z
    .object({
      sourceAccountId: requiredChoiceSchema,
      targetAccountId: requiredChoiceSchema,
      date: isoDateSchema,
      amount: positiveAmountInputSchema(locale),
      label: labelSchema,
      note: noteInputSchema,
    })
    .refine(
      (transfer) => transfer.sourceAccountId !== transfer.targetAccountId,
      { error: 'same_account', path: ['targetAccountId'] },
    )
}

export function occurrenceFormSchema(locale: string) {
  return z
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
        const cents = parseAmountInput(occurrence.amount, locale)
        if (cents === null || cents <= 0) {
          context.addIssue({
            code: 'custom',
            message: 'amount_not_positive',
            path: ['amount'],
          })
        }
      }
    })
}

export function envelopeFormSchema(locale: string) {
  return z.object({
    label: labelSchema,
    amount: positiveAmountInputSchema(locale),
    source: requiredChoiceSchema,
    categoryIds: z
      .array(z.string(), { error: 'required' })
      .min(1, { error: 'required' }),
  })
}

export function envelopeMonthAmountFormSchema(locale: string) {
  return z.object({
    amount: amountInputSchema(locale).refine((cents) => cents >= 0, {
      error: 'amount_out_of_range',
    }),
  })
}

export function scheduleFormSchema(locale: string) {
  return z.object({
    label: labelSchema,
    amount: positiveAmountInputSchema(locale),
    interval: z
      .number({ error: 'invalid' })
      .int({ error: 'invalid' })
      .min(1, { error: 'interval_out_of_range' })
      .max(maxScheduleInterval, { error: 'interval_out_of_range' }),
    startDate: isoDateSchema,
    note: noteInputSchema,
  })
}

export function ruleFormSchema(locale: string) {
  return z
    .object({
      pattern: z
        .string({ error: 'required' })
        .trim()
        .min(1, { error: 'required' })
        .max(rulePatternMaxLength, { error: 'too_long' }),
      amountMin: optionalAmountInputSchema(locale),
      amountMax: optionalAmountInputSchema(locale),
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
}

export const importFileFormSchema = z.object({
  accountId: z.string({ error: 'required' }).min(1, { error: 'required' }),
})

export function statementFormSchema(locale: string) {
  return z.object({
    date: isoDateSchema,
    balance: amountInputSchema(locale),
  })
}

export function valuationFormSchema(locale: string) {
  return z.object({
    date: isoDateSchema,
    value: amountInputSchema(locale),
  })
}

export const passkeyFormSchema = z.object({
  name: passkeyNameSchema,
  password: currentPasswordSchema,
})

export const passkeyRenameFormSchema = z.object({ name: passkeyNameSchema })

export const exportFormSchema = z.object({ password: currentPasswordSchema })

export const accountDeletionEmailSchema = z.object({ email: emailSchema })

export const accountDeletionFormSchema = z.object({
  email: emailSchema,
  password: currentPasswordSchema,
})
