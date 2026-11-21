import { userProfileSchema } from '@mint/shared/schemas/user'
import type { SessionStatus, UserProfile } from '~~/types/session'

export const useSessionStore = defineStore('session', () => {
  const user = ref<UserProfile | null>(null)
  const status = ref<SessionStatus>('unknown')
  const role = computed(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  const toast = useToast()
  const i18n = useNuxtApp().$i18n

  function setUser(profile: UserProfile): void {
    user.value = profile
    status.value = 'authenticated'
  }

  async function forgetDeviceData(): Promise<void> {
    if (!(await clearOfflineCache())) {
      toast.add({
        title: i18n.t('offline.clearFailed'),
        icon: icons.error,
        color: 'error',
      })
    }
  }

  function clear(): void {
    user.value = null
    status.value = 'anonymous'
    resetCsrfToken()
    useAmountMaskStore().forget()
    void forgetDeviceData()
  }

  async function load(): Promise<void> {
    try {
      setUser(await apiGet('/auth/session', userProfileSchema))
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.code === 'offline_unavailable')
      ) {
        clear()
        return
      }
      throw error
    }
  }

  async function refresh(): Promise<void> {
    setUser(await apiGet('/auth/session', userProfileSchema))
  }

  async function login(email: string, password: string): Promise<void> {
    const profile = await apiCall('POST', '/auth/login', userProfileSchema, {
      email,
      password,
    })
    resetCsrfToken()
    await forgetDeviceData()
    setUser(profile)
  }

  async function loginWithPasskey(): Promise<boolean> {
    const result = await signInWithPasskey()
    if (typeof result === 'string') {
      return false
    }
    resetCsrfToken()
    await forgetDeviceData()
    setUser(result)
    return true
  }

  async function logout(): Promise<void> {
    await apiCommand('POST', '/auth/logout')
    clear()
  }

  return {
    user,
    status,
    role,
    isAdmin,
    setUser,
    clear,
    load,
    refresh,
    login,
    loginWithPasskey,
    logout,
  }
})
