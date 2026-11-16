import type { OfflineEntry } from '~~/types/offline'

export const offlineCacheName = 'mint-offline-data'

const cacheablePaths = [
  /^\/auth\/session$/,
  /^\/accounts\/overview$/,
  /^\/payment-methods$/,
  /^\/categories$/,
  /^\/tags$/,
  /^\/dashboard\/(summary|breakdown|monthly)$/,
  /^\/forecast\/curve$/,
  /^\/calendar\/\d{4}-\d{2}-01$/,
  /^\/schedules$/,
  /^\/operations$/,
]

export function isOfflineCacheable(path: string): boolean {
  const pathname = path.split('?')[0] ?? ''
  return cacheablePaths.some((pattern) => pattern.test(pathname))
}

function cacheKey(path: string): Request {
  return new Request(new URL(`/api/v1${path}`, window.location.origin))
}

function cacheStorage(): CacheStorage | null {
  return 'caches' in globalThis ? globalThis.caches : null
}

function isOfflineEntry(value: unknown): value is OfflineEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'savedAt' in value &&
    typeof value.savedAt === 'string' &&
    'body' in value
  )
}

export async function storeOfflineEntry(
  path: string,
  entry: OfflineEntry,
): Promise<boolean> {
  const storage = cacheStorage()
  if (storage === null) {
    return false
  }
  try {
    const cache = await storage.open(offlineCacheName)
    await cache.put(
      cacheKey(path),
      new Response(JSON.stringify(entry), {
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    return true
  } catch {
    return false
  }
}

export async function readOfflineEntry(
  path: string,
): Promise<OfflineEntry | null> {
  const storage = cacheStorage()
  if (storage === null) {
    return null
  }
  try {
    const cache = await storage.open(offlineCacheName)
    const response = await cache.match(cacheKey(path))
    if (response === undefined) {
      return null
    }
    const entry: unknown = await response.json()
    return isOfflineEntry(entry) ? entry : null
  } catch {
    return null
  }
}

export async function clearOfflineCache(): Promise<boolean> {
  const storage = cacheStorage()
  if (storage === null) {
    return true
  }
  try {
    await storage.delete(offlineCacheName)
    return true
  } catch {
    return false
  }
}
