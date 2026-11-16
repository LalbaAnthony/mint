const prefetchDelayMs = 2_000

export function useOfflineSync(): void {
  const connectivity = useConnectivityStore()
  const session = useSessionStore()
  const view = useForecastViewStore()
  const router = useRouter()

  let prefetchTimer: ReturnType<typeof setTimeout> | undefined
  let running = false

  async function prefetch(): Promise<void> {
    if (running || session.user === null || navigator.onLine === false) {
      return
    }
    running = true
    try {
      const today = parisDate(new Date())
      await prefetchOfflineData(
        offlineViewPaths(
          today,
          view.scopeQuery(view.dashboardAccountId),
          view.scopeQuery(view.calendarAccountId),
          view.horizonMonths,
        ),
        today,
      )
    } finally {
      running = false
    }
  }

  function schedulePrefetch(): void {
    clearTimeout(prefetchTimer)
    prefetchTimer = setTimeout(() => void prefetch(), prefetchDelayMs)
  }

  function onOnline(): void {
    schedulePrefetch()
  }

  let stopRoutes: (() => void) | undefined

  onMounted(() => {
    stopRoutes = router.beforeEach(() => {
      connectivity.startView()
    })
    window.addEventListener('online', onOnline)
    schedulePrefetch()
  })

  onBeforeUnmount(() => {
    clearTimeout(prefetchTimer)
    stopRoutes?.()
    window.removeEventListener('online', onOnline)
  })
}
