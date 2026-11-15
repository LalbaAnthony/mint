export type ReconciliationLine = {
  accountId: string
  date: string
  amountCents: number
  bankLabel: string
}

export type ReconciliationOccurrence = {
  scheduleId: string
  scheduleLabel: string
  patterns: string[]
  tolerancePct: number
  originalDate: string
  effectiveDate: string
  accountId: string
  amountCents: number
  operationId: string | null
  reconciledWithBank: boolean
}

export type ScoredCandidate = {
  occurrence: ReconciliationOccurrence
  score: number
  dayGap: number
}
