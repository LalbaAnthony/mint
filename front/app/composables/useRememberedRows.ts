import type { LoadState } from '~~/types/skeleton'

export function useRememberedRows(
  key: string,
  state: LoadState,
  lengths: () => number[],
  fallback: readonly number[] = [skeletonRowCount],
) {
  const store = useSkeletonCountsStore()
  watch(
    () => (state.phase === 'ready' ? lengths() : null),
    (values) => {
      if (values !== null) {
        store.remember(key, values)
      }
    },
  )
  return computed(() => store.rowsOf(key, fallback))
}

export function useRememberedCount(
  key: string,
  state: LoadState,
  length: () => number,
) {
  const rows = useRememberedRows(key, state, () => [length()])
  return computed(() => rows.value[0] ?? skeletonRowCount)
}
