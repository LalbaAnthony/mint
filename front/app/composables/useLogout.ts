export function useLogout() {
  const session = useSessionStore()
  const toast = useToast()
  const { errorMessage } = useFormValidation()

  return async function logout(): Promise<void> {
    try {
      await session.logout()
      await navigateTo('/login')
    } catch (error) {
      toast.add({
        title: errorMessage(error),
        icon: icons.error,
        color: 'error',
      })
    }
  }
}
