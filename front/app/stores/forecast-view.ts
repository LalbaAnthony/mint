export const useForecastViewStore = defineStore('forecastView', () => {
  const session = useSessionStore()
  const horizonOverride = ref<number | null>(null)
  const dashboardAccountId = ref<string | null>(null)
  const calendarAccountId = ref<string | null>(null)

  const horizonMonths = computed({
    get: () =>
      horizonOverride.value ?? session.user?.forecastHorizonMonths ?? 3,
    set: (months: number) => {
      horizonOverride.value = months
    },
  })

  watch(
    () => session.user?.id,
    () => {
      horizonOverride.value = null
      dashboardAccountId.value = null
      calendarAccountId.value = null
    },
  )

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
