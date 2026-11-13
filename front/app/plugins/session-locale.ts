export default defineNuxtPlugin((nuxtApp) => {
  const session = useSessionStore()
  watch(
    () => session.user?.locale,
    async (locale) => {
      if (locale !== undefined) {
        await nuxtApp.$i18n.setLocale(locale)
      }
    },
    { immediate: true },
  )
})
