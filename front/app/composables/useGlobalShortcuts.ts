import { useMediaQuery } from '@vueuse/core'

export function useGlobalShortcuts(): void {
  const { profileEntry } = useNavigation()
  const connectivity = useConnectivityStore()
  const search = useSearchStore()
  const quickAdd = useQuickAddStore()
  const amountMask = useAmountMaskStore()
  const notifications = useNotificationsStore()
  const shortcuts = useShortcutsStore()
  const { addVisible } = useFloatingButtons()
  const isDesktopLayout = useMediaQuery('(min-width: 1024px)')

  useShortcut('search', () => search.openModal(), {
    enabled: () => !connectivity.offline,
    fallback: true,
  })

  useShortcut(
    'create',
    () => {
      if (isDesktopLayout.value) {
        quickAdd.menuOpen = true
      } else {
        quickAdd.drawerOpen = true
      }
    },
    {
      enabled: () =>
        !connectivity.offline && (isDesktopLayout.value || addVisible.value),
      fallback: true,
    },
  )

  useShortcut('profile', () => {
    void navigateTo(profileEntry.value.to)
  })

  useShortcut('amountMask', () => amountMask.toggle())

  useShortcut('notifications', () => {
    notifications.open = true
  })

  useShortcut('help', () => {
    shortcuts.helpOpen = true
  })
}
