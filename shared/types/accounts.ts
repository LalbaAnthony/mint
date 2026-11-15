import type { z } from 'zod'
import type {
  accountNatureSchema,
  accountOverviewSchema,
  accountSchema,
  accountUsageGroupSchema,
  accountUsageSchema,
  createAccountRequestSchema,
  regulatedProductSchema,
  regulatedCapListResponseSchema,
  regulatedCapSchema,
  reorderAccountsRequestSchema,
  updateAccountRequestSchema,
  updateRegulatedCapRequestSchema,
} from '../schemas/accounts.js'
import type { InterestSettings } from './interest.js'
import type { ValuationPoint } from './valuations.js'

export type AccountNature = z.infer<typeof accountNatureSchema>

export type AccountUsage = z.infer<typeof accountUsageSchema>

export type RegulatedProduct = z.infer<typeof regulatedProductSchema>

export type RegulatedProductIssue = 'product_required' | 'product_mismatch'

export type CreateAccountRequest = z.infer<typeof createAccountRequestSchema>

export type UpdateAccountRequest = z.infer<typeof updateAccountRequestSchema>

export type Account = z.infer<typeof accountSchema>

export type AccountUsageGroup = z.infer<typeof accountUsageGroupSchema>

export type AccountOverview = z.infer<typeof accountOverviewSchema>

export type ReorderAccountsRequest = z.infer<
  typeof reorderAccountsRequestSchema
>

export type AccountInput = {
  id: string
  usage: AccountUsage
  initialBalanceCents: number
  initialBalanceDate: string
  lowBalanceThresholdCents: number | null
  archived: boolean
  valuations: ValuationPoint[]
  depositCapCents: number | null
  capitalizedInterestCents: number
  interest: InterestSettings | null
}

export type RegulatedCap = z.infer<typeof regulatedCapSchema>

export type RegulatedCapListResponse = z.infer<
  typeof regulatedCapListResponseSchema
>

export type UpdateRegulatedCapRequest = z.infer<
  typeof updateRegulatedCapRequestSchema
>
