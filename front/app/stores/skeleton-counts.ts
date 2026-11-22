import type { SkeletonCounts } from '~~/types/skeleton'

export const skeletonCountsStorageKey = 'mint:skeleton-counts'

function isSkeletonCounts(value: unknown): value is SkeletonCounts {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every(
      (entry) =>
        Array.isArray(entry) &&
        entry.every(
          (count: unknown) => typeof count === 'number' && count >= 0,
        ),
    )
  )
}

function readStoredCounts(): SkeletonCounts {
  try {
    const stored = window.sessionStorage.getItem(skeletonCountsStorageKey)
    const parsed: unknown = stored === null ? {} : JSON.parse(stored)
    return isSkeletonCounts(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function writeStoredCounts(counts: SkeletonCounts | null): boolean {
  try {
    if (counts === null) {
      window.sessionStorage.removeItem(skeletonCountsStorageKey)
    } else {
      window.sessionStorage.setItem(
        skeletonCountsStorageKey,
        JSON.stringify(counts),
      )
    }
    return true
  } catch {
    return false
  }
}

export const useSkeletonCountsStore = defineStore('skeleton-counts', () => {
  const counts = ref<SkeletonCounts>(
    import.meta.client ? readStoredCounts() : {},
  )

  function rowsOf(key: string, fallback: readonly number[]): number[] {
    const remembered = counts.value[key]
    if (remembered === undefined) {
      return fallback.map(clampSkeletonRows)
    }
    return remembered.length === 0 ? [1] : remembered.map(clampSkeletonRows)
  }

  function remember(key: string, values: number[]): void {
    counts.value = { ...counts.value, [key]: values }
    writeStoredCounts(counts.value)
  }

  function forget(): void {
    counts.value = {}
    writeStoredCounts(null)
  }

  return { counts, rowsOf, remember, forget }
})
