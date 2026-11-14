import type { z } from 'zod'
import type {
  createPaymentMethodRequestSchema,
  paymentMethodKindSchema,
  paymentMethodSchema,
  updatePaymentMethodRequestSchema,
} from '../schemas/payment-methods.js'

export type PaymentMethodKind = z.infer<typeof paymentMethodKindSchema>

export type CreatePaymentMethodRequest = z.infer<
  typeof createPaymentMethodRequestSchema
>

export type UpdatePaymentMethodRequest = z.infer<
  typeof updatePaymentMethodRequestSchema
>

export type PaymentMethod = z.infer<typeof paymentMethodSchema>
