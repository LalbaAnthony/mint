import { z } from 'zod'
import { labelSchema } from './common.js'

export const paymentMethodKinds = [
  'card',
  'transfer_out',
  'third_party',
] as const

export const paymentMethodKindSchema = z
  .enum(paymentMethodKinds, { error: 'invalid' })
  .meta({ id: 'PaymentMethodKind' })

const paymentMethodFieldsSchema = z.object({
  label: labelSchema,
  kind: paymentMethodKindSchema,
  accountId: z.uuid({ error: 'required' }),
})

export const createPaymentMethodRequestSchema = paymentMethodFieldsSchema.meta({
  id: 'CreatePaymentMethodRequest',
})

export const updatePaymentMethodRequestSchema = paymentMethodFieldsSchema
  .partial()
  .meta({ id: 'UpdatePaymentMethodRequest' })

export const paymentMethodSchema = z
  .object({
    id: z.uuid(),
    label: z.string(),
    kind: paymentMethodKindSchema,
    accountId: z.uuid(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'PaymentMethod' })

export const paymentMethodListResponseSchema = z
  .array(paymentMethodSchema)
  .meta({ id: 'PaymentMethodListResponse' })
