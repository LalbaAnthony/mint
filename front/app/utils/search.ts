import { maxAmountCents } from '@mint/shared/schemas/common'
import { searchMinLength } from '@mint/shared/schemas/search'
import type { SearchResponse } from '@mint/shared/types/search'
import type { RouteLocationRaw } from 'vue-router'

export const searchPagePath = '/search'

export function isSearchable(text: string): boolean {
  return text.trim().length >= searchMinLength
}

export function searchRequestPath(
  text: string,
  locale: string,
  offset: number,
  limit: number,
): string {
  const q = text.trim()
  const params = new URLSearchParams({
    q,
    operationsOffset: String(offset),
    operationsLimit: String(limit),
  })
  const cents = parseAmountInput(q, locale)
  if (cents !== null && Math.abs(cents) <= maxAmountCents) {
    params.set('amountCents', String(Math.abs(cents)))
  }
  return `/search?${params.toString()}`
}

export function searchPageLocation(text: string): RouteLocationRaw {
  return { path: searchPagePath, query: { q: text.trim() } }
}

export function searchRowCount(response: SearchResponse | null): number {
  return response === null
    ? 0
    : response.accounts.length +
        response.operations.items.length +
        response.schedules.length +
        response.envelopes.length
}
