import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import { UApp } from '#components'
import { accountOverviewSchema } from '@mint/shared/schemas/accounts'
import { categoryListResponseSchema } from '@mint/shared/schemas/categories'
import ViewPanel from '~/components/ViewPanel.vue'
import OperationsPage from '~/pages/operations/index.vue'
import { installFakeApi } from '../fake-api'
import { installMemoryCaches } from '../offline-caches'
import {
  account,
  ids,
  operation,
  overview,
  referentialHandlers,
} from '../planning-fixtures'
import { signIn, testProfile } from '../session'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

function goOffline(): void {
  fetchMock.mockReset()
  fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
}

function cachedAt(isoInstant: string): string {
  return new Intl.DateTimeFormat('fr', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(new Date(isoInstant))
}

function inApp(component: object) {
  return defineComponent({
    setup() {
      return () => h(UApp, null, { default: () => h(component) })
    },
  })
}

beforeEach(() => {
  resetCsrfToken()
  installMemoryCaches()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-16T08:30:00Z'))
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  useConnectivityStore().backOnline()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('offline copies of the API (NF-PWA-02, US-20)', () => {
  it('keeps the responses of the offline views and serves them without network', async () => {
    const accounts = overview([account()])
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => accounts,
    })
    expect(await apiGet('/accounts/overview', accountOverviewSchema)).toEqual(
      accounts,
    )
    vi.setSystemTime(new Date('2026-11-16T10:00:00Z'))
    goOffline()

    const offline = await apiGet('/accounts/overview', accountOverviewSchema)

    expect(offline).toEqual(accounts)
    const connectivity = useConnectivityStore()
    expect(connectivity.offline).toBe(true)
    expect(connectivity.dataAt).toBe('2026-11-16T08:30:00.000Z')
    const wrapper = await mountSuspended(ViewPanel, {
      props: { title: 'Comptes' },
    })
    mounted.push(wrapper)
    const banner = wrapper.get('[data-testid="offline-banner"]')
    expect(banner.text()).toBe(
      `Hors ligne : données du ${cachedAt('2026-11-16T08:30:00.000Z')}`,
    )
  })

  it('answers from the copy at once when the browser is offline', async () => {
    installFakeApi(fetchMock, { 'GET /categories': () => [] })
    await apiGet('/categories', categoryListResponseSchema)
    fetchMock.mockClear()
    vi.stubGlobal('navigator', { ...navigator, onLine: false })

    expect(await apiGet('/categories', categoryListResponseSchema)).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('does not keep the other views and says when nothing is stored', async () => {
    goOffline()

    await expect(apiGet('/rules', categoryListResponseSchema)).rejects.toThrow(
      'network_error',
    )
    await expect(
      apiGet('/categories', categoryListResponseSchema),
    ).rejects.toThrow('offline_unavailable')
    expect(isOfflineCacheable('/calendar/2026-12-01?horizonMonths=3')).toBe(
      true,
    )
    expect(isOfflineCacheable('/rules')).toBe(false)
    expect(isOfflineCacheable('/profile/passkeys')).toBe(false)
  })

  it('refuses every write while offline', async () => {
    useConnectivityStore().wentOffline()

    await expect(apiCommand('POST', '/operations', {})).rejects.toThrow(
      'offline',
    )
    await expect(
      apiDownload('/profile/export', { password: 'x' }),
    ).rejects.toThrow('offline')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('offline data is forgotten (NF-PWA-03)', () => {
  it('empties the copies at logout and at the next login', async () => {
    const stores = installMemoryCaches()
    installFakeApi(fetchMock, {
      'GET /categories': () => [],
      'POST /auth/logout': () => undefined,
      'POST /auth/login': () => testProfile,
    })
    await apiGet('/categories', categoryListResponseSchema)
    expect(stores.get(offlineCacheName)?.size).toBe(1)

    await useSessionStore().logout()
    await vi.waitFor(() => {
      expect(stores.has(offlineCacheName)).toBe(false)
    })

    await apiGet('/categories', categoryListResponseSchema)
    await useSessionStore().login('me@example.org', 'correct horse battery')
    expect(stores.has(offlineCacheName)).toBe(false)
    signIn()
  })
})

describe('offline preparation (NF-PWA-02)', () => {
  it('stores the next calendar month and the operations of the last 90 days', async () => {
    const stores = installMemoryCaches()
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] })
    vi.setSystemTime(new Date('2026-11-16T08:30:00Z'))
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /dashboard/summary': () => ({}),
      'GET /forecast/curve?horizonMonths=3': () => ({}),
      'GET /dashboard/breakdown?from=2026-11-01&to=2026-11-30': () => ({}),
      'GET /dashboard/monthly?horizonMonths=3': () => ({}),
      'GET /calendar/2026-11-01?horizonMonths=3': () => ({}),
      'GET /calendar/2026-12-01?horizonMonths=3': () => ({}),
      'GET /schedules': () => ({}),
      'GET /operations?page=1&pageSize=100&sort=date&order=desc&from=2026-08-19&to=2026-11-16':
        () => ({ items: [operation()], total: 101, page: 1, pageSize: 100 }),
      'GET /operations?page=2&pageSize=100&sort=date&order=desc&from=2026-08-19&to=2026-11-16':
        () => ({
          items: [operation({ id: ids.transferGroup })],
          total: 101,
          page: 2,
          pageSize: 100,
        }),
    })
    const Host = defineComponent({
      setup() {
        useOfflineSync()
        return () => h('div')
      },
    })
    const wrapper = await mountSuspended(Host)
    mounted.push(wrapper)

    await vi.advanceTimersByTimeAsync(2_000)
    vi.useRealTimers()

    await vi.waitFor(() => {
      expect(stores.get(offlineCacheName)?.size).toBe(14)
    })
    expect(api.requests.map((request) => request.path)).toContain(
      '/calendar/2026-12-01?horizonMonths=3',
    )
    const recent = await offlineOperations()
    expect(recent?.items.map((item) => item.id)).toEqual([
      ids.operation,
      ids.transferGroup,
    ])
  })
})

describe('offline views (NF-PWA-02, CHG-68)', () => {
  it('shows the stored 90 days of operations with the writes disabled', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    await useReferentialsStore().load()
    await storeOfflineEntry('/operations?window=offline', {
      savedAt: '2026-11-16T07:00:00.000Z',
      body: { items: [operation()], total: 1, page: 1, pageSize: 1 },
    })
    goOffline()
    useConnectivityStore().wentOffline()

    const wrapper = await mountSuspended(inApp(OperationsPage), {
      route: '/operations',
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Courses')
    })
    expect(wrapper.get('[data-testid="operations-offline"]').text()).toBe(
      'Hors ligne : opérations des 90 derniers jours, sans recherche ni filtre.',
    )
    expect(
      wrapper.get('[data-testid="operations-add"]').attributes(),
    ).toHaveProperty('disabled')
    expect(wrapper.find('[data-testid="offline-guard"]').exists()).toBe(true)
    expect(
      wrapper.get('input[data-testid="operations-search"]').attributes(),
    ).toHaveProperty('disabled')
    expect(wrapper.get('[data-testid="offline-banner"]').text()).toContain(
      cachedAt('2026-11-16T07:00:00.000Z'),
    )
  })
})

describe('new version (NF-PWA-04, CHG-68)', () => {
  it('offers to reload in a persistent toast', async () => {
    const updateServiceWorker = vi.fn(() => Promise.resolve())
    const nuxtApp = useNuxtApp()
    nuxtApp.provide('pwa', reactive({ needRefresh: true, updateServiceWorker }))
    const Host = defineComponent({
      setup() {
        usePwaUpdates()
        return () => h('div')
      },
    })

    const wrapper = await mountSuspended(Host)
    mounted.push(wrapper)
    await nextTick()

    const toast = useToast().toasts.value.find(
      (candidate) => candidate.id === 'pwa-update',
    )
    expect(toast).toMatchObject({
      title: 'Nouvelle version disponible',
      color: 'info',
      duration: 0,
    })
    const [reload] = toast?.actions ?? []
    expect(reload?.label).toBe('Recharger')
    expect(reload?.icon).toBe('lucide:refresh-cw')
    const handlers = [reload?.onClick ?? []].flat()
    for (const handler of handlers) {
      handler(new MouseEvent('click'))
    }
    expect(updateServiceWorker).toHaveBeenCalledWith(true)
    useToast().clear()
  })
})
