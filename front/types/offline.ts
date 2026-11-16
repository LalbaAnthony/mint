export type OfflineEntry = {
  savedAt: string
  body: unknown
}

export type OfflinePrefetchResult = {
  outcome: 'completed' | 'interrupted'
  failedPaths: string[]
}
