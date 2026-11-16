import {
  addDays,
  addMonthsToMonth,
  monthEnd,
  monthStart,
} from '@mint/shared/engines/dates'
import { operationListResponseSchema } from '@mint/shared/schemas/operations'
import type { OperationListResponse } from '@mint/shared/types/operations'
import type { OfflinePrefetchResult } from '~~/types/offline'

export const offlineOperationDays = 90

export const offlineOperationPageSize = 100

export const offlineOperationMaxPages = 20

export const offlineOperationsKey = '/operations?window=offline'

export function curvePath(scopeQuery: string): string {
  return `/forecast/curve?${scopeQuery}`
}

export function breakdownPath(from: string, to: string): string {
  return `/dashboard/breakdown?from=${from}&to=${to}`
}

export function monthlyReportPath(horizonMonths: number): string {
  return `/dashboard/monthly?horizonMonths=${horizonMonths}`
}

export function calendarMonthPath(month: string, scopeQuery: string): string {
  return `/calendar/${month}?${scopeQuery}`
}

function recentOperationsPath(today: string, page: number): string {
  const from = addDays(today, 1 - offlineOperationDays)
  return `/operations?page=${page}&pageSize=${offlineOperationPageSize}&sort=date&order=desc&from=${from}&to=${today}`
}

export function offlineViewPaths(
  today: string,
  curveScope: string,
  calendarScope: string,
  horizonMonths: number,
): string[] {
  const month = monthStart(today)
  return [
    '/accounts/overview',
    '/payment-methods',
    '/categories',
    '/tags',
    '/dashboard/summary',
    curvePath(curveScope),
    breakdownPath(month, monthEnd(month)),
    monthlyReportPath(horizonMonths),
    calendarMonthPath(month, calendarScope),
    calendarMonthPath(addMonthsToMonth(month, 1), calendarScope),
    '/schedules',
  ]
}

function isNetworkFailure(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'network_error' ||
      error.code === 'offline' ||
      error.code === 'offline_unavailable')
  )
}

async function prefetchRecentOperations(today: string): Promise<void> {
  const first = await apiGet(
    recentOperationsPath(today, 1),
    operationListResponseSchema,
  )
  const pageCount = Math.min(
    Math.ceil(first.total / offlineOperationPageSize),
    offlineOperationMaxPages,
  )
  const items = [...first.items]
  for (let page = 2; page <= pageCount; page += 1) {
    const next = await apiGet(
      recentOperationsPath(today, page),
      operationListResponseSchema,
    )
    items.push(...next.items)
  }
  const merged: OperationListResponse = {
    items,
    total: items.length,
    page: 1,
    pageSize: Math.max(items.length, 1),
  }
  await storeOfflineEntry(offlineOperationsKey, {
    savedAt: new Date().toISOString(),
    body: merged,
  })
}

export async function prefetchOfflineData(
  paths: string[],
  today: string,
): Promise<OfflinePrefetchResult> {
  const failedPaths: string[] = []
  for (const path of paths) {
    try {
      await prefetchOffline(path)
    } catch (error) {
      if (isNetworkFailure(error)) {
        return { outcome: 'interrupted', failedPaths }
      }
      failedPaths.push(path)
    }
  }
  try {
    await prefetchRecentOperations(today)
  } catch (error) {
    if (isNetworkFailure(error)) {
      return { outcome: 'interrupted', failedPaths }
    }
    failedPaths.push(offlineOperationsKey)
  }
  return { outcome: 'completed', failedPaths }
}

export async function offlineOperations(): Promise<OperationListResponse | null> {
  const entry = await readOfflineEntry(offlineOperationsKey)
  if (entry === null) {
    return null
  }
  useConnectivityStore().servedFromCache(entry.savedAt)
  return operationListResponseSchema.parse(entry.body)
}
