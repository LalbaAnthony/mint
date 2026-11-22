import { useDebounceFn } from '@vueuse/core'
import { searchResponseSchema } from '@mint/shared/schemas/search'
import type { SearchResponse } from '@mint/shared/types/search'
import type { GlobalSearchOptions } from '~~/types/search'

const searchDelayMs = 300

export function useGlobalSearch(options: GlobalSearchOptions) {
  const { locale } = useI18n()
  const toast = useToast()
  const { errorMessage } = useFormValidation()
  const connectivity = useConnectivityStore()

  const text = ref(options.initialText ?? '')
  const result = ref<SearchResponse | null>(null)
  const loading = ref(false)
  const loadingMore = ref(false)
  let requestId = 0

  const searchable = computed(() => isSearchable(text.value))

  const hasMore = computed(
    () =>
      result.value !== null &&
      result.value.operations.items.length < result.value.operations.total,
  )

  function notifyFailure(error: unknown): void {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  }

  function fetchBatch(query: string, offset: number): Promise<SearchResponse> {
    return apiGet(
      searchRequestPath(query, locale.value, offset, options.operationsLimit),
      searchResponseSchema,
    )
  }

  function reset(): void {
    requestId += 1
    result.value = null
    loading.value = false
    loadingMore.value = false
  }

  async function runNow(): Promise<void> {
    const query = text.value
    if (!isSearchable(query) || connectivity.offline) {
      reset()
      return
    }
    requestId += 1
    const current = requestId
    loading.value = true
    try {
      const response = await fetchBatch(query, 0)
      if (current === requestId) {
        result.value = response
      }
    } catch (error) {
      if (current === requestId) {
        notifyFailure(error)
      }
    } finally {
      if (current === requestId) {
        loading.value = false
      }
    }
  }

  const runLater = useDebounceFn(runNow, searchDelayMs)

  watch(text, (value) => {
    if (!isSearchable(value)) {
      reset()
      return
    }
    void runLater()
  })

  async function loadMore(): Promise<void> {
    const base = result.value
    if (base === null || connectivity.offline) {
      return
    }
    const current = requestId
    loadingMore.value = true
    try {
      const next = await fetchBatch(text.value, base.operations.items.length)
      if (current !== requestId) {
        return
      }
      const known = new Set(base.operations.items.map((item) => item.id))
      result.value = {
        ...next,
        operations: {
          items: [
            ...base.operations.items,
            ...next.operations.items.filter((item) => !known.has(item.id)),
          ],
          total: next.operations.total,
        },
      }
    } catch (error) {
      if (current === requestId) {
        notifyFailure(error)
      }
    } finally {
      if (current === requestId) {
        loadingMore.value = false
      }
    }
  }

  return {
    text,
    result,
    loading,
    loadingMore,
    searchable,
    hasMore,
    runNow,
    loadMore,
    reset,
  }
}
