import type { UserProfile, UserRole } from '~~/types/session'

export const testProfile: UserProfile = {
  id: '00000000-0000-4000-8000-000000000001',
  email: 'me@example.org',
  role: 'user',
  locale: 'fr',
  theme: 'system',
  forecastHorizonMonths: 3,
  targets: { needs: 50, wants: 30, save: 20 },
  defaultAccountId: null,
}

export function signIn(
  role: UserRole = 'user',
  overrides: Partial<UserProfile> = {},
): void {
  useSessionStore().setUser({ ...testProfile, role, ...overrides })
}

export function setDefaultAccount(defaultAccountId: string | null): void {
  signIn('user', { defaultAccountId })
}

export function signOut(): void {
  useSessionStore().clear()
}
