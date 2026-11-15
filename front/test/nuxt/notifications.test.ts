import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import type {
  Notification,
  NotificationListResponse,
  PushDevice,
} from '@mint/shared/types/notifications'
import NotificationBell from '~/components/NotificationBell.vue'
import NotificationCenter from '~/components/NotificationCenter.vue'
import NotificationSettings from '~/components/NotificationSettings.vue'
import ScheduleFormModal from '~/components/ScheduleFormModal.vue'
import ViewPanel from '~/components/ViewPanel.vue'
import CalendarPage from '~/pages/calendar/index.vue'
import SchedulesPage from '~/pages/schedules/index.vue'
import { apiFailure, installFakeApi } from '../fake-api'
import {
  euros,
  fillInput,
  findInBody,
  ids,
  referentialHandlers,
  schedule,
  setViewportWidth,
  submit,
} from '../planning-fixtures'
import { signOut } from '../session'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

const notificationIds = {
  lowBalance: '00000000-0000-4000-8000-000000000101',
  reminder: '00000000-0000-4000-8000-000000000102',
  depositCap: '00000000-0000-4000-8000-000000000103',
}

const deviceId = '00000000-0000-4000-8000-000000000201'

const lowBalance: Notification = {
  id: notificationIds.lowBalance,
  type: 'low_balance',
  payload: {
    accountId: ids.current,
    accountName: 'Compte courant',
    minDate: '2026-12-05',
    minCents: 15_000,
    thresholdCents: 20_000,
  },
  readAt: null,
  createdAt: '2026-11-15T07:00:00.000Z',
}

const reminder: Notification = {
  id: notificationIds.reminder,
  type: 'manual_reminder',
  payload: {
    scheduleId: ids.schedule,
    scheduleLabel: 'Loyer',
    kind: 'expense',
    accountId: ids.current,
    originalDate: '2026-11-17',
    effectiveDate: '2026-11-17',
    amountCents: 80_000,
    dueToday: false,
  },
  readAt: null,
  createdAt: '2026-11-15T07:00:00.000Z',
}

const depositCap: Notification = {
  id: notificationIds.depositCap,
  type: 'deposit_cap',
  payload: {
    accountId: ids.livret,
    accountName: 'Livret A',
    scheduleId: ids.schedule,
    scheduleLabel: 'Epargne',
    originalDate: '2026-12-06',
    date: '2026-12-06',
    excessCents: 5_000,
  },
  readAt: '2026-11-15T08:00:00.000Z',
  createdAt: '2026-11-14T07:00:00.000Z',
}

const device: PushDevice = {
  id: deviceId,
  endpoint: 'https://push.example.org/device-1',
  userAgent: 'Firefox sur Linux',
  lastSuccessAt: null,
  createdAt: '2026-11-10T09:00:00.000Z',
}

function listOf(notifications: Notification[]): NotificationListResponse {
  return {
    notifications,
    unreadCount: notifications.filter((item) => item.readAt === null).length,
  }
}

function longDate(isoDate: string): string {
  return new Intl.DateTimeFormat('fr', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00Z`))
}

function notificationRequests(
  requests: { method: string; path: string }[],
): number {
  return requests.filter(
    (request) => request.method === 'GET' && request.path === '/notifications',
  ).length
}

function defineGlobal(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, configurable: true })
}

const RefreshHost = defineComponent({
  setup() {
    useNotificationRefresh()
    return () => h('div')
  },
})

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'userAgent')
  Reflect.deleteProperty(navigator, 'serviceWorker')
  useNotificationsStore().reset()
  useToast().clear()
  useForecastViewStore().calendarAccountId = null
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('notification bell (NOTIF-04, CHG-51, CHG-56)', () => {
  it('shows the coral unread counter in the view header', async () => {
    installFakeApi(fetchMock, {
      'GET /notifications': () => listOf([lowBalance, reminder, depositCap]),
    })
    await useNotificationsStore().refresh()

    const wrapper = await mountSuspended(ViewPanel, {
      props: { title: 'Comptes' },
    })
    mounted.push(wrapper)

    const bell = wrapper.get('[data-testid="notification-bell"]')
    expect(bell.attributes('aria-label')).toBe('Notifications, 2 non lues')
    const counter = bell.get('[data-testid="notification-counter"]')
    expect(counter.text()).toBe('2')
    expect(counter.classes()).toEqual(
      expect.arrayContaining([
        'rounded-full',
        'bg-accent-fill',
        'text-accent-on-fill',
        'text-xs',
        'font-semibold',
      ]),
    )

    await bell.trigger('click')
    expect(useNotificationsStore().open).toBe(true)
  })

  it('hides the counter without unread notification and caps it at 99+', async () => {
    const store = useNotificationsStore()
    const wrapper = await mountSuspended(NotificationBell)
    mounted.push(wrapper)

    expect(wrapper.find('[data-testid="notification-counter"]').exists()).toBe(
      false,
    )
    expect(wrapper.attributes('aria-label')).toBe('Notifications')

    store.unreadCount = 150
    await nextTick()
    expect(wrapper.get('[data-testid="notification-counter"]').text()).toBe(
      '99+',
    )
  })
})

describe('notification center (NOTIF-04, CHG-67)', () => {
  it('lists the notifications with their texts and read state', async () => {
    installFakeApi(fetchMock, {
      'GET /notifications': () => listOf([lowBalance, reminder, depositCap]),
    })
    const store = useNotificationsStore()
    await store.refresh()
    store.open = true

    const wrapper = await mountSuspended(NotificationCenter)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="notification-center"]')).not.toBeNull()
    })

    const low = findInBody(`[data-testid="notification-${lowBalance.id}"]`)
    expect(low?.textContent).toContain('Solde bas : Compte courant')
    expect(low?.textContent).toContain(
      `${euros(15_000)} prévus le ${longDate('2026-12-05')}, sous le seuil de ${euros(20_000)}.`,
    )
    expect(low?.querySelector('.text-warning')).not.toBeNull()
    expect(
      low?.querySelector('[data-testid="notification-unread-dot"]')?.className,
    ).toContain('size-2')
    expect(
      low?.querySelector('[data-testid="notification-title"]')?.className,
    ).toContain('font-semibold')

    const due = findInBody(`[data-testid="notification-${reminder.id}"]`)
    expect(due?.textContent).toContain('Paiement à faire : Loyer')
    expect(due?.textContent).toContain(
      `${euros(80_000)} à régler le ${longDate('2026-11-17')}.`,
    )
    const marker = due?.querySelector('[aria-label="Paiement manuel"]')
    expect(marker?.className).toContain('bg-accent-fill')

    const cap = findInBody(`[data-testid="notification-${depositCap.id}"]`)
    expect(cap?.textContent).toContain('Plafond dépassé : Livret A')
    expect(cap?.textContent).toContain(
      `Dépassement de ${euros(5_000)} le ${longDate('2026-12-06')}.`,
    )
    expect(
      cap?.querySelector('[data-testid="notification-unread-dot"]'),
    ).toBeNull()
    expect(
      cap?.querySelector('[data-testid="notification-title"]')?.className,
    ).toEqual(expect.stringContaining('text-toned'))
    expect(document.body.textContent).toContain('2 notifications non lues')
  })

  it('marks a notification read and opens its object', async () => {
    let notifications = [lowBalance, reminder]
    const api = installFakeApi(fetchMock, {
      'GET /notifications': () => listOf(notifications),
      [`POST /notifications/${lowBalance.id}/read`]: () => {
        notifications = [
          { ...lowBalance, readAt: '2026-11-15T09:00:00.000Z' },
          reminder,
        ]
        return undefined
      },
    })
    const store = useNotificationsStore()
    await store.refresh()
    store.open = true

    const wrapper = await mountSuspended(NotificationCenter)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="notification-center"]')).not.toBeNull()
    })
    findInBody(`[data-testid="notification-open-${lowBalance.id}"]`)?.click()

    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.fullPath).toBe(
        `/calendar?account=${ids.current}&day=2026-12-05`,
      )
    })
    expect(
      api.requests.some(
        (request) =>
          request.method === 'POST' &&
          request.path === `/notifications/${lowBalance.id}/read`,
      ),
    ).toBe(true)
    expect(store.unreadCount).toBe(1)
    expect(store.open).toBe(false)
  })

  it('marks every notification read and deletes one', async () => {
    let notifications = [lowBalance, reminder]
    const api = installFakeApi(fetchMock, {
      'GET /notifications': () => listOf(notifications),
      'POST /notifications/read-all': () => {
        notifications = notifications.map((item) => ({
          ...item,
          readAt: '2026-11-15T09:00:00.000Z',
        }))
        return undefined
      },
      [`DELETE /notifications/${reminder.id}`]: () => {
        notifications = notifications.filter((item) => item.id !== reminder.id)
        return undefined
      },
    })
    const store = useNotificationsStore()
    await store.refresh()
    store.open = true

    const wrapper = await mountSuspended(NotificationCenter)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="notifications-read-all"]'),
      ).not.toBeNull()
    })
    findInBody('[data-testid="notifications-read-all"]')?.click()
    await vi.waitFor(() => {
      expect(store.unreadCount).toBe(0)
    })
    expect(findInBody('[data-testid="notifications-read-all"]')).toBeNull()

    findInBody(`[data-testid="notification-delete-${reminder.id}"]`)?.click()
    await vi.waitFor(() => {
      expect(store.notifications.map((item) => item.id)).toEqual([
        lowBalance.id,
      ])
    })
    expect(
      api.requests
        .filter((request) => request.method !== 'GET')
        .map((request) => `${request.method} ${request.path}`),
    ).toEqual([
      'POST /notifications/read-all',
      `DELETE /notifications/${reminder.id}`,
    ])
  })

  it('shows an empty state without notification', async () => {
    const store = useNotificationsStore()
    store.open = true

    const wrapper = await mountSuspended(NotificationCenter)
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('Aucune notification')
    })
  })
})

describe('notification refresh (NOTIF-04, NOTIF-06)', () => {
  it('refreshes on mount, after a data change, on focus and resets on logout', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /notifications': () => listOf([lowBalance]),
      'POST /operations': () => ({}),
      'POST /notifications/read-all': () => undefined,
    })
    const wrapper = await mountSuspended(RefreshHost)
    mounted.push(wrapper)
    const store = useNotificationsStore()
    await vi.waitFor(() => {
      expect(store.unreadCount).toBe(1)
    })
    const afterMount = notificationRequests(api.requests)

    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    await apiCommand('POST', '/operations', {})
    await vi.advanceTimersByTimeAsync(2_999)
    expect(notificationRequests(api.requests)).toBe(afterMount)
    await vi.advanceTimersByTimeAsync(1)
    expect(notificationRequests(api.requests)).toBe(afterMount + 1)

    await apiCommand('POST', '/notifications/read-all')
    await vi.advanceTimersByTimeAsync(3_000)
    expect(notificationRequests(api.requests)).toBe(afterMount + 1)
    vi.useRealTimers()

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => {
      expect(notificationRequests(api.requests)).toBe(afterMount + 2)
    })

    signOut()
    await nextTick()
    expect(store.unreadCount).toBe(0)
    expect(store.notifications).toEqual([])
  })

  it('reports a failing refresh once until it succeeds again', async () => {
    installFakeApi(fetchMock, {
      'GET /notifications': () => apiFailure(500, { error: 'internal_error' }),
    })
    const wrapper = await mountSuspended(RefreshHost)
    mounted.push(wrapper)
    const toast = useToast()
    await vi.waitFor(() => {
      expect(toast.toasts.value).toHaveLength(1)
    })

    window.dispatchEvent(new Event('focus'))
    await vi.waitFor(() => {
      expect(
        fetchMock.mock.calls.filter(([url]) => url === '/api/v1/notifications'),
      ).toHaveLength(2)
    })
    await nextTick()
    expect(toast.toasts.value).toHaveLength(1)
  })
})

describe('notification settings (NOTIF-05, NOTIF-08, NOTIF-09)', () => {
  it('saves a push preference and removes a device', async () => {
    let devices = [device]
    const api = installFakeApi(fetchMock, {
      'GET /notifications/preferences': () => ({
        lowBalancePush: true,
        manualReminderPush: true,
      }),
      'PATCH /notifications/preferences': () => ({
        lowBalancePush: true,
        manualReminderPush: false,
      }),
      'GET /push/key': () => ({ publicKey: null }),
      'GET /push/subscriptions': () => devices,
      [`DELETE /push/subscriptions/${deviceId}`]: () => {
        devices = []
        return undefined
      },
    })
    const wrapper = await mountSuspended(NotificationSettings)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain(
        'Les notifications push ne sont pas configurées sur ce serveur.',
      )
    })
    const row = wrapper.get(`[data-testid="push-device-${deviceId}"]`)
    expect(row.text()).toContain('Firefox sur Linux')
    expect(row.text()).toContain('dernier envoi : aucun')

    await wrapper
      .get('[data-testid="notification-preference-manualReminderPush"]')
      .trigger('click')
    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'PATCH')?.body,
      ).toEqual({ manualReminderPush: false })
    })

    await wrapper
      .get(`[data-testid="push-device-remove-${deviceId}"]`)
      .trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="push-devices-empty"]').exists()).toBe(
        true,
      )
    })
  })

  it('shows the installation procedure on an iPhone browser tab', async () => {
    defineGlobal(
      navigator,
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15',
    )
    installFakeApi(fetchMock, {
      'GET /notifications/preferences': () => ({
        lowBalancePush: true,
        manualReminderPush: true,
      }),
      'GET /push/key': () => ({ publicKey: 'AQID' }),
      'GET /push/subscriptions': () => [],
    })
    const wrapper = await mountSuspended(NotificationSettings)
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="push-ios-install"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.text()).toContain("Sur l'écran d'accueil")
    expect(wrapper.find('[data-testid="push-enable"]').exists()).toBe(false)
  })
})

describe('push utilities (NOTIF-03, NOTIF-09)', () => {
  function installServiceWorker(pushManager: object): void {
    defineGlobal(navigator, 'serviceWorker', {
      getRegistration: () => Promise.resolve({ pushManager }),
    })
  }

  function browserSubscription(endpoint: string) {
    return {
      endpoint,
      toJSON: () => ({ keys: { p256dh: 'p256dh-key', auth: 'auth-key' } }),
      unsubscribe: vi.fn(() => Promise.resolve(true)),
    }
  }

  it('detects the support of the current browser', () => {
    defineGlobal(
      navigator,
      'userAgent',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',
    )
    expect(pushSupport()).toBe('ios-install')

    defineGlobal(navigator, 'userAgent', 'Mozilla/5.0 (X11; Linux x86_64)')
    expect(pushSupport()).toBe('unsupported')

    installServiceWorker({})
    vi.stubGlobal('PushManager', class {})
    vi.stubGlobal('Notification', { permission: 'default' })
    expect(pushSupport()).toBe('available')
  })

  it('subscribes this device with the server key and records it', async () => {
    const subscription = browserSubscription('https://push.example.org/new')
    const subscribe = vi.fn(() => Promise.resolve(subscription))
    installServiceWorker({
      subscribe,
      getSubscription: () => Promise.resolve(null),
    })
    vi.stubGlobal('Notification', {
      requestPermission: () => Promise.resolve('granted'),
    })
    const api = installFakeApi(fetchMock, {
      'POST /push/subscriptions': () => ({
        ...device,
        endpoint: subscription.endpoint,
      }),
    })

    const result = await subscribeThisDevice('AQID')

    expect(result).toEqual({ ...device, endpoint: subscription.endpoint })
    expect(subscribe).toHaveBeenCalledWith({
      userVisibleOnly: true,
      applicationServerKey: new Uint8Array([1, 2, 3]),
    })
    expect(
      api.requests.find((request) => request.method === 'POST')?.body,
    ).toEqual({
      endpoint: 'https://push.example.org/new',
      keys: { p256dh: 'p256dh-key', auth: 'auth-key' },
    })
  })

  it('replaces a subscription made with a former server key', async () => {
    const former = browserSubscription('https://push.example.org/former')
    const renewed = browserSubscription('https://push.example.org/renewed')
    const subscribe = vi
      .fn()
      .mockRejectedValueOnce(new DOMException('key', 'InvalidStateError'))
      .mockResolvedValueOnce(renewed)
    installServiceWorker({
      subscribe,
      getSubscription: () => Promise.resolve(former),
    })
    vi.stubGlobal('Notification', {
      requestPermission: () => Promise.resolve('granted'),
    })
    installFakeApi(fetchMock, {
      'POST /push/subscriptions': () => ({
        ...device,
        endpoint: renewed.endpoint,
      }),
    })

    await subscribeThisDevice('AQID')

    expect(former.unsubscribe).toHaveBeenCalledTimes(1)
    expect(subscribe).toHaveBeenCalledTimes(2)
  })

  it('stops when the permission is refused', async () => {
    const subscribe = vi.fn()
    installServiceWorker({ subscribe })
    vi.stubGlobal('Notification', {
      requestPermission: () => Promise.resolve('denied'),
    })
    const api = installFakeApi(fetchMock, {})

    expect(await subscribeThisDevice('AQID')).toBe('denied')
    expect(subscribe).not.toHaveBeenCalled()
    expect(api.requests).toEqual([])
  })
})

describe('reminder delay (NOTIF-02, ECH-02)', () => {
  it('edits the reminder delay of a manual schedule only', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`PATCH /schedules/${ids.schedule}`]: () => ({
        schedule: schedule({ triggerMode: 'manual', reminderDaysBefore: 5 }),
        removedExceptions: 0,
      }),
    })
    await useReferentialsStore().load()
    const automatic = await mountSuspended(ScheduleFormModal, {
      props: { open: true, schedule: schedule() },
    })
    mounted.push(automatic)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="schedule-form"]')).not.toBeNull()
    })
    expect(findInBody('[data-testid="schedule-reminder-days"]')).toBeNull()
    automatic.unmount()
    mounted.pop()
    document.body.innerHTML = ''

    const manual = await mountSuspended(ScheduleFormModal, {
      props: {
        open: true,
        schedule: schedule({ triggerMode: 'manual', reminderDaysBefore: 3 }),
      },
    })
    mounted.push(manual)
    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="schedule-reminder-days"]'),
      ).not.toBeNull()
    })
    const input = findInBody('[data-testid="schedule-reminder-days"]')
    expect(input instanceof HTMLInputElement ? input.value : null).toBe('3')
    await fillInput('[data-testid="schedule-reminder-days"]', '5')
    input?.dispatchEvent(new FocusEvent('blur'))
    await nextTick()
    submit('[data-testid="schedule-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'PATCH')?.body,
      ).toEqual(expect.objectContaining({ reminderDaysBefore: 5 }))
    })
  })
})

describe('notification links (NOTIF-04, NOTIF-07)', () => {
  it('opens the calendar on the account and the day of an alert', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-15T10:00:00Z'))
    setViewportWidth(1280)
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /calendar/2026-12-01?accountId=${ids.current}&horizonMonths=3`]:
        () => ({
          today: '2026-11-15',
          accountId: ids.current,
          thresholdCents: 20_000,
          horizonMonths: 3,
          endDate: '2027-02-15',
          month: '2026-12-01',
          firstMonth: '2026-11-01',
          lastMonth: '2027-02-01',
          days: Array.from({ length: 31 }, (_, index) => ({
            date: `2026-12-${String(index + 1).padStart(2, '0')}`,
            period: 'future',
            balanceCents: 15_000,
            operations: [],
            occurrences: [],
            envelopeShares: [],
          })),
        }),
    })

    const wrapper = await mountSuspended(CalendarPage, {
      route: `/calendar?account=${ids.current}&day=2026-12-05`,
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(
        wrapper.get('[data-testid="calendar-day-2026-12-05"]').classes(),
      ).toContain('ring-2')
    })
    expect(useForecastViewStore().calendarAccountId).toBe(ids.current)
    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.query).toEqual({})
    })
  })

  it('opens the schedule of a cap alert', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /schedules': () => ({
        schedules: [schedule()],
        totals: { expensesCents: 0, incomesCents: 0, savingsTransfersCents: 0 },
      }),
      [`GET /schedules/${ids.schedule}/occurrences`]: () => ({
        from: '2026-11-15',
        to: '2027-02-15',
        occurrences: [],
      }),
    })

    const wrapper = await mountSuspended(SchedulesPage, {
      route: `/schedules?schedule=${ids.schedule}`,
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="schedule-detail"]')).not.toBeNull()
    })
  })
})
