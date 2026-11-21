export const useForecastViewStore = defineStore('forecastView', () => {
  const session = useSessionStore()
  const horizonOverride = ref<number | null>(null)
  const dashboardOverride = ref<string | null | undefined>(undefined)
  const calendarOverride = ref<string | null | undefined>(undefined)

  const horizonMonths = computed({
    get: () =>
      horizonOverride.value ?? session.user?.forecastHorizonMonths ?? 3,
    set: (months: number) => {
      horizonOverride.value = months
    },
  })

  const defaultAccountId = computed(
    () => session.user?.defaultAccountId ?? null,
  )

  const dashboardAccountId = computed({
    get: () =>
      dashboardOverride.value === undefined
        ? defaultAccountId.value
        : dashboardOverride.value,
    set: (accountId: string | null) => {
      dashboardOverride.value = accountId
    },
  })

  const calendarAccountId = computed({
    get: () =>
      calendarOverride.value === undefined
        ? defaultAccountId.value
        : calendarOverride.value,
    set: (accountId: string | null) => {
      calendarOverride.value = accountId
    },
  })

  function followDefaultAccount(): void {
    dashboardOverride.value = undefined
    calendarOverride.value = undefined
  }

  watch(
    () => session.user?.id,
    () => {
      horizonOverride.value = null
      followDefaultAccount()
    },
  )

  watch(defaultAccountId, followDefaultAccount)

  function scopeQuery(accountId: string | null): string {
    const params = new URLSearchParams()
    if (accountId !== null) {
      params.set('accountId', accountId)
    }
    params.set('horizonMonths', String(horizonMonths.value))
    return params.toString()
  }

  return {
    horizonMonths,
    dashboardAccountId,
    calendarAccountId,
    scopeQuery,
  }
})
