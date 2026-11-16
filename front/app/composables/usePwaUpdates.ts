const updateToastId = 'pwa-update'

async function checkForUpdate(): Promise<boolean> {
  if (
    document.visibilityState !== 'visible' ||
    navigator.onLine === false ||
    !('serviceWorker' in navigator)
  ) {
    return false
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration()
    await registration?.update()
    return registration !== undefined
  } catch {
    return false
  }
}

export function usePwaUpdates(): void {
  const { $pwa } = useNuxtApp()
  const toast = useToast()
  const { t } = useI18n()

  function announceUpdate(): void {
    toast.add({
      id: updateToastId,
      title: t('pwaUpdate.available'),
      icon: icons.info,
      color: 'info',
      duration: 0,
      close: false,
      actions: [
        {
          label: t('pwaUpdate.reload'),
          icon: icons.reload,
          color: 'info',
          variant: 'soft',
          onClick: () => {
            void $pwa?.updateServiceWorker(true)
          },
        },
      ],
    })
  }

  watch(
    () => $pwa?.needRefresh === true,
    (needRefresh) => {
      if (needRefresh) {
        announceUpdate()
      }
    },
    { immediate: true },
  )

  function onVisibilityChange(): void {
    void checkForUpdate()
  }

  onMounted(() => {
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onBeforeUnmount(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })
}
