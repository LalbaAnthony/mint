import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountsPage from '~/pages/accounts/index.vue'
import CalendarPage from '~/pages/calendar/index.vue'
import EnvelopesPage from '~/pages/envelopes/index.vue'
import OperationsPage from '~/pages/operations/index.vue'
import RulesPage from '~/pages/rules/index.vue'
import SchedulesPage from '~/pages/schedules/index.vue'
import SubscriptionsPage from '~/pages/subscriptions/index.vue'
import { apiFailure, installFakeApi } from '../fake-api'
import {
  envelopeLine,
  envelopeMonth,
  referentialHandlers,
  setViewportWidth,
} from '../planning-fixtures'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []
const initialWidth = window.innerWidth

function never(): Promise<never> {
  return new Promise(() => undefined)
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  setViewportWidth(initialWidth)
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

async function mountView(
  page: Parameters<typeof mountInApp>[0],
  route: string,
) {
  const wrapper = await mountInApp(page, { route })
  mounted.push(wrapper)
  return wrapper
}

function visibleZone(wrapper: Awaited<ReturnType<typeof mountView>>) {
  return wrapper
    .findAll('[data-testid="skeleton-zone"]')
    .find((zone) => !zone.classes().includes('invisible'))
}

describe('accounts skeleton (CHG-47 to CHG-49)', () => {
  it('shows the total and two account groups while loading, reorder disabled', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': never,
      'GET /payment-methods': () => [],
    })

    const wrapper = await mountView(AccountsPage, '/accounts')

    expect(
      wrapper.get('[data-testid="accounts-reorder"]').attributes('disabled'),
    ).toBeDefined()
    await vi.waitFor(() => {
      expect(visibleZone(wrapper)).toBeDefined()
    })
    expect(
      wrapper.findAll('[data-testid="account-group-skeleton"]'),
    ).toHaveLength(2)
    expect(wrapper.text()).toContain('Total')
  })

  it('replaces a failed load with a retry state, then the content', async () => {
    let attempts = 0
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => {
        attempts += 1
        return attempts === 1
          ? apiFailure(500, { error: 'internal' })
          : { totalCents: 0, groups: [], archived: [] }
      },
      'GET /payment-methods': () => [],
    })

    const wrapper = await mountView(AccountsPage, '/accounts')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(true)
    })
    await wrapper.get('[data-testid="load-error-retry"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun compte')
    })
    expect(wrapper.find('[data-testid="accounts-reorder"]').exists()).toBe(
      false,
    )
  })
})

describe('list views skeletons (CHG-47, CHG-48)', () => {
  it.each([
    [1280, 'tbody > tr'],
    [360, 'ul > li'],
  ])(
    'shows three operation rows while the list loads at %i px',
    async (width, rowSelector) => {
      setViewportWidth(width)
      installFakeApi(fetchMock, {
        ...referentialHandlers(),
        'GET /operations?page=1&pageSize=50&sort=date&order=desc': never,
      })

      const wrapper = await mountView(OperationsPage, '/operations')

      await vi.waitFor(() => {
        expect(
          wrapper.find('[data-testid="operations-list-skeleton"]').exists(),
        ).toBe(true)
      })
      expect(wrapper.find('[data-testid="operations-search"]').exists()).toBe(
        true,
      )
      expect(
        wrapper
          .get('[data-testid="operations-list-skeleton"]')
          .findAll(rowSelector),
      ).toHaveLength(3)
    },
  )

  it('keeps the schedule kind filter while the totals and list load', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /schedules': never,
    })

    const wrapper = await mountView(SchedulesPage, '/schedules')

    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="schedules-list-skeleton"]').exists(),
      ).toBe(true)
    })
    expect(wrapper.find('[data-testid="schedule-kind-filter"]').exists()).toBe(
      true,
    )
    expect(wrapper.text()).toContain('Dépenses')
  })

  it('shows the subscription totals and list skeletons', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /subscriptions': never,
    })

    const wrapper = await mountView(SubscriptionsPage, '/subscriptions')

    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="subscriptions-list-skeleton"]').exists(),
      ).toBe(true)
    })
  })

  it('shows the rule priority help above the rule skeletons', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /rules': never,
    })

    const wrapper = await mountView(RulesPage, '/rules')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="rules-list-skeleton"]').exists()).toBe(
        true,
      )
    })
    expect(
      wrapper.get('[data-testid="rules-reorder"]').attributes('disabled'),
    ).toBeDefined()
    expect(
      wrapper.get('[data-testid="rules-list-skeleton"]').findAll('ol > li'),
    ).toHaveLength(3)
  })

  it('shows the month navigation at once and the envelopes skeleton on a month change', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /envelopes': () => envelopeMonth([envelopeLine(0)]),
      'GET /envelopes?month=2026-12-01': never,
    })

    const wrapper = await mountView(EnvelopesPage, '/envelopes')

    expect(wrapper.find('[data-testid="envelopes-month"]').text()).not.toBe('')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="envelopes-list"]').exists()).toBe(true)
    })
    await wrapper.get('[data-testid="envelopes-next"]').trigger('click')
    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="envelopes-list-skeleton"]').exists(),
      ).toBe(true)
    })
    expect(wrapper.get('[data-testid="envelopes-month"]').text()).toBe(
      'décembre 2026',
    )
  })
})

describe('calendar skeleton (CHG-48)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-11T10:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the real month grid with skeleton days while the month loads', async () => {
    useReferentialsStore().accounts = []
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /calendar/2026-11-01?horizonMonths=3': never,
    })

    const wrapper = await mountView(CalendarPage, '/calendar')

    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="calendar-grid-skeleton"]').exists(),
      ).toBe(true)
    })
    expect(wrapper.get('[data-testid="calendar-month"]').text()).toBe(
      'novembre 2026',
    )
    const grid = wrapper.get('[data-testid="calendar-grid-skeleton"]')
    expect(grid.findAll('.grid-cols-7')).toHaveLength(7)
    expect(grid.text()).toContain('30')
    expect(grid.get('.bg-primary').text()).toBe('11')
    expect(wrapper.find('[data-testid="calendar-day-skeleton"]').exists()).toBe(
      true,
    )
  })
})
