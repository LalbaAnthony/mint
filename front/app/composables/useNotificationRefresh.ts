import { notificationsChangedMessage } from '~~/service-worker/notifications'

const mutationRefreshDelayMs = 3_000
const alertNeutralPrefixes = ['/auth/', '/admin/', '/notifications', '/push/']

function isAlertNeutral(path: string): boolean {
  return alertNeutralPrefixes.some((prefix) => path.startsWith(prefix))
}

function isNotificationsChanged(data: unknown): boolean {
  return (
    typeof data === 'object' &&
    data !== null &&
    'type' in data &&
    data.type === notificationsChangedMessage
  )
}

function serviceWorkerContainer(): ServiceWorkerContainer | null {
  return 'serviceWorker' in navigator ? navigator.serviceWorker : null
}

export function useNotificationRefresh(): void {
  const store = useNotificationsStore()
  const session = useSessionStore()
  const router = useRouter()
  const toast = useToast()
  const { errorMessage } = useFormValidation()

  let failing = false

  async function refresh(): Promise<void> {
    if (session.user === null) {
      return
    }
    try {
      await store.refresh()
      failing = false
    } catch (error) {
      if (!failing) {
        toast.add({
          title: errorMessage(error),
          icon: icons.error,
          color: 'error',
        })
      }
      failing = true
    }
  }

  function refreshNow(): void {
    void refresh()
  }

  let pendingTimer: ReturnType<typeof setTimeout> | undefined
  function refreshSoon(path: string): void {
    if (isAlertNeutral(path)) {
      return
    }
    clearTimeout(pendingTimer)
    pendingTimer = setTimeout(refreshNow, mutationRefreshDelayMs)
  }

  function onWorkerMessage(event: MessageEvent): void {
    if (isNotificationsChanged(event.data)) {
      refreshNow()
    }
  }

  let stopMutations: (() => void) | undefined
  let stopRoutes: (() => void) | undefined

  onMounted(() => {
    refreshNow()
    stopRoutes = router.afterEach(refreshNow)
    stopMutations = onApiMutation(refreshSoon)
    window.addEventListener('focus', refreshNow)
    serviceWorkerContainer()?.addEventListener('message', onWorkerMessage)
  })

  onBeforeUnmount(() => {
    clearTimeout(pendingTimer)
    stopRoutes?.()
    stopMutations?.()
    window.removeEventListener('focus', refreshNow)
    serviceWorkerContainer()?.removeEventListener('message', onWorkerMessage)
  })

  watch(
    () => session.user?.id,
    (id) => {
      if (id === undefined) {
        store.reset()
      } else {
        refreshNow()
      }
    },
  )
}
