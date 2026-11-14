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
