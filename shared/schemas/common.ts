import { z } from 'zod'

export const labelMaxLength = 100
export const maxAmountCents = 99_999_999_999

export const labelSchema = z
  .string({ error: 'required' })
  .trim()
  .min(1, { error: 'required' })
  .max(labelMaxLength, { error: 'too_long' })

export const amountCentsSchema = z
  .number({ error: 'invalid_amount' })
  .int({ error: 'invalid_amount' })
  .min(-maxAmountCents, { error: 'amount_out_of_range' })
  .max(maxAmountCents, { error: 'amount_out_of_range' })

export const isoDateSchema = z.iso.date({ error: 'invalid_date' })

export const orderedIdsSchema = z
  .array(z.uuid({ error: 'invalid' }), { error: 'invalid' })
  .min(1, { error: 'required' })
  .max(200, { error: 'too_long' })
