import type { Operation } from '@mint/shared/types/operations'
import type { OperationFilterState, OperationSorting } from '~~/types/planning'

export function emptyOperationFilters(): OperationFilterState {
  return {
    q: '',
    from: '',
    to: '',
    accountIds: [],
    groups: [],
    categoryIds: [],
    tagIds: [],
    minAmount: '',
    maxAmount: '',
    direction: undefined,
    origins: [],
    status: undefined,
    reconciled: undefined,
    unconfirmed: false,
  }
}

function absoluteCents(text: string, locale: string): number | null {
  const cents = parseAmountInput(text, locale)
  return cents === null ? null : Math.abs(cents)
}

export function operationQuery(
  filters: OperationFilterState,
  sorting: OperationSorting,
  page: number,
  pageSize: number,
  locale: string,
): string {
  const params = new URLSearchParams()
  params.set('page', String(page))
  params.set('pageSize', String(pageSize))
  params.set('sort', sorting.sort)
  params.set('order', sorting.order)
  const q = filters.q.trim()
  if (q !== '') {
    params.set('q', q)
  }
  if (filters.from !== '') {
    params.set('from', filters.from)
  }
  if (filters.to !== '') {
    params.set('to', filters.to)
  }
  for (const id of filters.accountIds) {
    params.append('accountIds', id)
  }
  for (const group of filters.groups) {
    params.append('groups', group)
  }
  for (const id of filters.categoryIds) {
    params.append('categoryIds', id)
  }
  for (const id of filters.tagIds) {
    params.append('tagIds', id)
  }
  const min = absoluteCents(filters.minAmount, locale)
  if (min !== null) {
    params.set('minCents', String(min))
  }
  const max = absoluteCents(filters.maxAmount, locale)
  if (max !== null) {
    params.set('maxCents', String(max))
  }
  if (filters.direction !== undefined) {
    params.set('direction', filters.direction)
  }
  for (const origin of filters.origins) {
    params.append('origins', origin)
  }
  if (filters.status !== undefined) {
    params.set('status', filters.status)
  }
  if (filters.reconciled !== undefined) {
    params.set('reconciled', String(filters.reconciled))
  }
  if (filters.unconfirmed) {
    params.set('unconfirmed', 'true')
  }
  return params.toString()
}

export function activeFilterCount(filters: OperationFilterState): number {
  return [
    filters.from !== '',
    filters.to !== '',
    filters.accountIds.length > 0,
    filters.groups.length > 0,
    filters.categoryIds.length > 0,
    filters.tagIds.length > 0,
    filters.minAmount !== '',
    filters.maxAmount !== '',
    filters.direction !== undefined,
    filters.origins.length > 0,
    filters.status !== undefined,
    filters.reconciled !== undefined,
    filters.unconfirmed,
  ].filter(Boolean).length
}

export function originIcon(operation: Operation): string {
  switch (operation.origin) {
    case 'manual':
      return icons.manualOrigin
    case 'import':
      return icons.import
    case 'schedule':
      return icons.schedules
  }
}
