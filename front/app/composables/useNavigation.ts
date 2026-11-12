import type {
  NavigationEntry,
  NavigationEntryId,
  QuickAddEntry,
  QuickAddKind,
} from '~~/types/navigation'

const navigationPaths: Record<NavigationEntryId, string> = {
  home: '/',
  accounts: '/accounts',
  calendar: '/calendar',
  operations: '/operations',
  schedules: '/schedules',
  subscriptions: '/subscriptions',
  envelopes: '/envelopes',
  import: '/import',
  rules: '/rules',
  profile: '/profile',
  administration: '/admin',
}

const quickAddKinds: QuickAddKind[] = ['expense', 'income', 'transfer']

export function useNavigation() {
  const { t } = useI18n()
  const route = useRoute()
  const session = useSessionStore()

  function createEntry(
    id: NavigationEntryId,
    labelKey = `navigation.${id}`,
  ): NavigationEntry {
    return { id, label: t(labelKey), icon: icons[id], to: navigationPaths[id] }
  }

  const mainEntries = computed(() => [
    createEntry('home'),
    createEntry('accounts'),
    createEntry('calendar'),
    createEntry('operations'),
  ])

  const planningEntries = computed(() => [
    createEntry('schedules'),
    createEntry('subscriptions'),
    createEntry('envelopes'),
  ])

  const toolEntries = computed(() => [
    createEntry('import'),
    createEntry('rules'),
  ])

  const profileEntry = computed(() =>
    createEntry('profile', 'navigation.profileAndPreferences'),
  )

  const administrationEntries = computed(() =>
    session.isAdmin ? [createEntry('administration')] : [],
  )

  const moreEntries = computed(() => [
    ...planningEntries.value,
    ...toolEntries.value,
    profileEntry.value,
    ...administrationEntries.value,
  ])

  const isMoreActive = computed(() =>
    moreEntries.value.some((entry) => isRouteActive(route.path, entry.to)),
  )

  const quickAddEntries = computed<QuickAddEntry[]>(() =>
    quickAddKinds.map((kind) => ({
      kind,
      label: t(`quickAdd.${kind}`),
      icon: icons[kind],
      disabled: true,
    })),
  )

  return {
    mainEntries,
    planningEntries,
    toolEntries,
    profileEntry,
    administrationEntries,
    moreEntries,
    isMoreActive,
    quickAddEntries,
  }
}
