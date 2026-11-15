import type { z } from 'zod'
import type {
  createValuationRequestSchema,
  investmentSummarySchema,
  updateValuationRequestSchema,
  valuationListResponseSchema,
  valuationPointSchema,
  valuationSchema,
} from '../schemas/valuations.js'

export type CreateValuationRequest = z.infer<
  typeof createValuationRequestSchema
>

export type UpdateValuationRequest = z.infer<
  typeof updateValuationRequestSchema
>

export type ValuationPoint = z.infer<typeof valuationPointSchema>

export type Valuation = z.infer<typeof valuationSchema>

export type InvestmentSummary = z.infer<typeof investmentSummarySchema>

export type ValuationListResponse = z.infer<typeof valuationListResponseSchema>
