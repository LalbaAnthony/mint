import type { z } from 'zod'
import type {
  createEnvelopeRequestSchema,
  envelopeMonthLineSchema,
  envelopeMonthQuerySchema,
  envelopeMonthResponseSchema,
  envelopeMonthStatusSchema,
  envelopeSchema,
  updateEnvelopeRequestSchema,
} from '../schemas/envelopes.js'
import type { CategorizedMovement } from './transactions.js'

export type EnvelopeMonthOverride = {
  month: string
  amountCents: number
}

export type EnvelopeInput = {
  id: string
  label: string
  accountId: string
  monthlyAmountCents: number
  carryOver: boolean
  active: boolean
  createdOn: string
  categoryIds: string[]
  monthOverrides: EnvelopeMonthOverride[]
}

export type EnvelopeMonthStatus = {
  envelopeId: string
  month: string
  budgetCents: number
  carriedOverCents: number
  consumedCents: number
  availableCents: number
}

export type EnvelopeShare = {
  envelopeId: string
  label: string
  accountId: string
  date: string
  amountCents: number
}

export type EnvelopeSharesInput = {
  today: string
  endDate: string
  envelopes: EnvelopeInput[]
  categoryIndex: ReadonlyMap<string, string>
  operations: readonly CategorizedMovement[]
  commitments: readonly CategorizedMovement[]
}

export type CreateEnvelopeRequest = z.infer<typeof createEnvelopeRequestSchema>

export type UpdateEnvelopeRequest = z.infer<typeof updateEnvelopeRequestSchema>

export type Envelope = z.infer<typeof envelopeSchema>

export type EnvelopeMonthQuery = z.infer<typeof envelopeMonthQuerySchema>

export type EnvelopeMonthStatusView = z.infer<typeof envelopeMonthStatusSchema>

export type EnvelopeMonthLine = z.infer<typeof envelopeMonthLineSchema>

export type EnvelopeMonthResponse = z.infer<typeof envelopeMonthResponseSchema>
