import { z } from 'zod'
import { isoDateSchema, maxAmountCents } from './common.js'

export const valuationValueSchema = z
  .number({ error: 'invalid_amount' })
  .int({ error: 'invalid_amount' })
  .min(0, { error: 'amount_out_of_range' })
  .max(maxAmountCents, { error: 'amount_out_of_range' })

export const createValuationRequestSchema = z
  .object({ date: isoDateSchema, valueCents: valuationValueSchema })
  .meta({ id: 'CreateValuationRequest' })

export const updateValuationRequestSchema = createValuationRequestSchema
  .partial()
  .meta({ id: 'UpdateValuationRequest' })

export const valuationPointSchema = z
  .object({ date: z.iso.date(), valueCents: z.number().int() })
  .meta({ id: 'ValuationPoint' })

export const valuationSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    date: z.iso.date(),
    valueCents: z.number().int(),
  })
  .meta({ id: 'Valuation' })

export const investmentSummarySchema = z
  .object({
    paidInCents: z.number().int(),
    referenceBalanceCents: z.number().int(),
    lastValuation: valuationPointSchema.nullable(),
    latentGainCents: z.number().int().nullable(),
  })
  .meta({ id: 'InvestmentSummary' })

export const valuationListResponseSchema = z
  .object({
    valuations: z.array(valuationSchema),
    summary: investmentSummarySchema,
  })
  .meta({ id: 'ValuationListResponse' })
