import type { z } from 'zod'
import type {
  capWarningSchema,
  capitalizationSchema,
  createInterestRateRequestSchema,
  interestMethodSchema,
  interestRateSchema,
  interestResponseSchema,
  interestSummarySchema,
} from '../schemas/interest.js'

export type InterestMethod = z.infer<typeof interestMethodSchema>

export type Capitalization = z.infer<typeof capitalizationSchema>

export type CreateInterestRateRequest = z.infer<
  typeof createInterestRateRequestSchema
>

export type InterestRate = z.infer<typeof interestRateSchema>

export type InterestSummary = z.infer<typeof interestSummarySchema>

export type InterestResponse = z.infer<typeof interestResponseSchema>

export type CapWarning = z.infer<typeof capWarningSchema>

export type InterestRateInput = {
  effectiveDate: string
  annualRatePct: number
}

export type InterestSettings = {
  method: InterestMethod
  capitalization: Capitalization
  anniversaryDate: string | null
  rates: InterestRateInput[]
}

export type InterestDay = {
  balanceCents: number
  debitsCents: number
  interestCreditsCents: number
}

export type InterestBase = {
  initialBalanceDate: string
  initialBalanceCents: number
  interest: InterestSettings | null
}
