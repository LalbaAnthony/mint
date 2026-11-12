import type { UserRole } from '~~/types/session'

export const useSessionStore = defineStore('session', () => {
  const role = ref<UserRole | null>(null)
  const isAdmin = computed(() => role.value === 'admin')

  return { role, isAdmin }
})
