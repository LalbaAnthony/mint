export type SearchTerms = {
  userId: string
  pattern: string
  amountCents: number | null
}

export type SearchOperationPage = {
  offset: number
  limit: number
}
