import { z } from 'zod'
import { isoDateSchema, maxAmountCents } from './common.js'

export const interestMethods = ['fortnight', 'daily'] as const

export const capitalizations = ['dec31', 'anniversary'] as const

export const maxAnnualRatePct = 99.9999

export const interestMethodSchema = z
  .enum(interestMethods, { error: 'invalid' })
  .meta({ id: 'InterestMethod' })

export const capitalizationSchema = z
  .enum(capitalizations, { error: 'invalid' })
  .meta({ id: 'Capitalization' })

export const capCentsSchema = z
  .number({ error: 'invalid_amount' })
  .int({ error: 'invalid_amount' })
  .min(1, { error: 'amount_not_positive' })
  .max(maxAmountCents, { error: 'amount_out_of_range' })

export const annualRatePctSchema = z
  .number({ error: 'invalid_rate' })
  .min(0, { error: 'rate_out_of_range' })
  .max(maxAnnualRatePct, { error: 'rate_out_of_range' })
  .refine(
    (rate) => Math.abs(Math.round(rate * 10_000) - rate * 10_000) < 1e-6,
    { error: 'rate_too_precise' },
  )

export const createInterestRateRequestSchema = z
  .object({
    effectiveDate: isoDateSchema,
    annualRatePct: annualRatePctSchema,
  })
  .meta({ id: 'CreateInterestRateRequest' })

export const interestRateSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    effectiveDate: z.iso.date(),
    annualRatePct: z.number(),
  })
  .meta({ id: 'InterestRate' })

export const interestSummarySchema = z
  .object({
    annualRatePct: z.number().nullable(),
    periodStart: z.iso.date(),
    acquiredCents: z.number().int(),
    nextCapitalizationDate: z.iso.date(),
    projectedCents: z.number().int(),
  })
  .meta({ id: 'InterestSummary' })

export const interestResponseSchema = z
  .object({
    rates: z.array(interestRateSchema),
    summary: interestSummarySchema,
  })
  .meta({ id: 'InterestResponse' })

export const capWarningSchema = z
  .object({
    accountId: z.uuid(),
    date: z.iso.date(),
    excessCents: z.number().int(),
  })
  .meta({ id: 'CapWarning' })
