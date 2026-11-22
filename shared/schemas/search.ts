import { z } from 'zod'
import { accountSchema } from './accounts.js'
import { maxAmountCents } from './common.js'
import { envelopeMonthStatusSchema, envelopeSchema } from './envelopes.js'
import { operationSchema } from './operations.js'
import { scheduleSchema } from './schedules.js'

export const searchMinLength = 2
export const searchMaxLength = 100
export const searchPreviewSize = 5
export const searchOperationsBatch = 50
export const maxSearchOperationsLimit = 100

export const searchTextSchema = z
  .string({ error: 'required' })
  .trim()
  .min(searchMinLength, { error: 'search_too_short' })
  .max(searchMaxLength, { error: 'too_long' })

export const searchQuerySchema = z
  .object({
    q: searchTextSchema,
    amountCents: z.coerce
      .number({ error: 'invalid_amount' })
      .int({ error: 'invalid_amount' })
      .min(0, { error: 'amount_out_of_range' })
      .max(maxAmountCents, { error: 'amount_out_of_range' })
      .optional(),
    operationsOffset: z.coerce
      .number({ error: 'invalid' })
      .int({ error: 'invalid' })
      .min(0, { error: 'invalid' })
      .default(0),
    operationsLimit: z.coerce
      .number({ error: 'invalid' })
      .int({ error: 'invalid' })
      .min(1, { error: 'invalid' })
      .max(maxSearchOperationsLimit, { error: 'invalid' })
      .default(searchOperationsBatch),
  })
  .meta({ id: 'SearchQuery' })

export const searchEnvelopeSchema = z
  .object({
    envelope: envelopeSchema,
    status: envelopeMonthStatusSchema.nullable(),
  })
  .meta({ id: 'SearchEnvelope' })

export const searchOperationsSchema = z
  .object({
    items: z.array(operationSchema),
    total: z.number().int(),
  })
  .meta({ id: 'SearchOperations' })

export const searchResponseSchema = z
  .object({
    accounts: z.array(accountSchema),
    operations: searchOperationsSchema,
    schedules: z.array(scheduleSchema),
    envelopes: z.array(searchEnvelopeSchema),
  })
  .meta({ id: 'SearchResponse' })
