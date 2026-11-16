export const useConnectivityStore = defineStore('connectivity', () => {
  const offline = ref(false)
  const dataAt = ref<string | null>(null)

  function servedFromCache(savedAt: string | null): void {
    offline.value = true
    if (savedAt !== null && (dataAt.value === null || savedAt < dataAt.value)) {
      dataAt.value = savedAt
    }
  }

  function wentOffline(): void {
    offline.value = true
  }

  function backOnline(): void {
    offline.value = false
    dataAt.value = null
  }

  function startView(): void {
    dataAt.value = null
  }

  if (import.meta.client) {
    offline.value = navigator.onLine === false
    window.addEventListener('offline', wentOffline)
    window.addEventListener('online', backOnline)
  }

  return {
    offline,
    dataAt,
    servedFromCache,
    wentOffline,
    backOnline,
    startView,
  }
})
