import type { InterestSummary } from '@mint/shared/types/interest'

export type SavingsSummary = {
  interest: InterestSummary | null
  depositCapExcessCents: number | null
}

export type CapCheckedMovement = {
  accountId: string
  date: string
  amountCents: number
}
