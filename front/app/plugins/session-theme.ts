export default defineNuxtPlugin(() => {
  const session = useSessionStore()
  const colorMode = useColorMode()
  watch(
    () => [session.status, session.user?.theme] as const,
    ([status, theme]) => {
      if (status !== 'unknown') {
        colorMode.preference = theme ?? 'system'
      }
    },
    { immediate: true },
  )
})
