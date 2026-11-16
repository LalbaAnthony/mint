import { z } from 'zod'
import { isoDateSchema, labelSchema, maxAmountCents } from './common.js'
import { positiveAmountCentsSchema } from './operations.js'

export const maxEnvelopeCategories = 50

const optionalIdSchema = z.uuid({ error: 'invalid' }).nullable()

export const envelopeFieldsSchema = z.object({
  label: labelSchema,
  monthlyAmountCents: positiveAmountCentsSchema,
  accountId: optionalIdSchema,
  paymentMethodId: optionalIdSchema,
  carryOver: z.boolean({ error: 'invalid' }),
  active: z.boolean({ error: 'invalid' }),
  categoryIds: z
    .array(z.uuid({ error: 'invalid' }), { error: 'required' })
    .min(1, { error: 'required' })
    .max(maxEnvelopeCategories, { error: 'too_long' })
    .refine((ids) => new Set(ids).size === ids.length, {
      error: 'duplicate',
    }),
})

export function defaultAccountIssue(envelope: {
  accountId: string | null
  paymentMethodId: string | null
}): boolean {
  return (envelope.accountId === null) === (envelope.paymentMethodId === null)
}

export const createEnvelopeRequestSchema = envelopeFieldsSchema
  .refine((envelope) => !defaultAccountIssue(envelope), {
    error: 'payment_or_account_required',
    path: ['accountId'],
  })
  .meta({ id: 'CreateEnvelopeRequest' })

export const updateEnvelopeRequestSchema = envelopeFieldsSchema
  .partial()
  .meta({ id: 'UpdateEnvelopeRequest' })

export const envelopeSchema = z
  .object({
    id: z.uuid(),
    label: z.string(),
    monthlyAmountCents: z.number().int(),
    accountId: z.uuid().nullable(),
    paymentMethodId: z.uuid().nullable(),
    carryOver: z.boolean(),
    active: z.boolean(),
    categoryIds: z.array(z.uuid()),
    createdAt: z.iso.datetime(),
  })
  .meta({ id: 'Envelope' })

export const monthSchema = isoDateSchema.refine(
  (date) => date.endsWith('-01'),
  { error: 'invalid_month' },
)

export const envelopeMonthQuerySchema = z
  .object({ month: monthSchema.optional() })
  .meta({ id: 'EnvelopeMonthQuery' })

export const envelopeMonthParamsSchema = z.object({
  id: z.uuid(),
  month: monthSchema,
})

export const envelopeMonthAmountRequestSchema = z
  .object({
    amountCents: z
      .number({ error: 'invalid_amount' })
      .int({ error: 'invalid_amount' })
      .min(0, { error: 'amount_out_of_range' })
      .max(maxAmountCents, { error: 'amount_out_of_range' }),
  })
  .meta({ id: 'EnvelopeMonthAmountRequest' })

export const envelopeMonthOverrideSchema = z
  .object({
    envelopeId: z.uuid(),
    month: z.iso.date(),
    amountCents: z.number().int(),
  })
  .meta({ id: 'EnvelopeMonthOverride' })

export const envelopeMonthStatusSchema = z
  .object({
    budgetCents: z.number().int(),
    overridden: z.boolean(),
    carriedOverCents: z.number().int(),
    consumedCents: z.number().int(),
    availableCents: z.number().int(),
    availablePerDayCents: z.number().int().nullable(),
  })
  .meta({ id: 'EnvelopeMonthStatus' })

export const envelopeMonthLineSchema = z
  .object({
    envelope: envelopeSchema,
    status: envelopeMonthStatusSchema,
  })
  .meta({ id: 'EnvelopeMonthLine' })

export const envelopeMonthTotalsSchema = z
  .object({
    budgetCents: z.number().int(),
    carriedOverCents: z.number().int(),
    consumedCents: z.number().int(),
    availableCents: z.number().int(),
  })
  .meta({ id: 'EnvelopeMonthTotals' })

export const envelopeMonthResponseSchema = z
  .object({
    month: z.iso.date(),
    currentMonth: z.iso.date(),
    remainingDays: z.number().int().nullable(),
    lines: z.array(envelopeMonthLineSchema),
    totals: envelopeMonthTotalsSchema,
    inactive: z.array(envelopeSchema),
  })
  .meta({ id: 'EnvelopeMonthResponse' })
