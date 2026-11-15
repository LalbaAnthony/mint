import { userProfileSchema } from '@mint/shared/schemas/user'
import type { SessionStatus, UserProfile } from '~~/types/session'

export const useSessionStore = defineStore('session', () => {
  const user = ref<UserProfile | null>(null)
  const status = ref<SessionStatus>('unknown')
  const role = computed(() => user.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')

  function setUser(profile: UserProfile): void {
    user.value = profile
    status.value = 'authenticated'
  }

  function clear(): void {
    user.value = null
    status.value = 'anonymous'
    resetCsrfToken()
  }

  async function load(): Promise<void> {
    try {
      setUser(await apiGet('/auth/session', userProfileSchema))
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        clear()
        return
      }
      throw error
    }
  }

  async function login(email: string, password: string): Promise<void> {
    const profile = await apiCall('POST', '/auth/login', userProfileSchema, {
      email,
      password,
    })
    resetCsrfToken()
    setUser(profile)
  }

  async function loginWithPasskey(): Promise<boolean> {
    const result = await signInWithPasskey()
    if (typeof result === 'string') {
      return false
    }
    resetCsrfToken()
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
    login,
    loginWithPasskey,
    logout,
  }
})
