import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionsPage from '~/pages/subscriptions/index.vue'
import { installFakeApi } from '../fake-api'
import {
  euros,
  referentialHandlers,
  schedule,
  setViewportWidth,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  resetCsrfToken()
  setViewportWidth(1280)
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('subscriptions view (ECH-09)', () => {
  it('shows the annual subscription at 3.68 EUR per month with its next occurrence and the totals (US-06)', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /subscriptions': () => ({
        subscriptions: [schedule()],
        totals: { monthlyCents: 368, annualCents: 4_416 },
      }),
    })

    const wrapper = await mountSuspended(SubscriptionsPage, {
      route: '/subscriptions',
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="subscriptions-table"]').exists()).toBe(
        true,
      )
    })
    const table = wrapper.get('[data-testid="subscriptions-table"]')
    expect(table.text()).toContain('Musique')
    expect(table.text()).toContain('Tous les ans')
    expect(table.text()).toContain(euros(368))
    expect(table.text()).toContain(euros(-4_416, 'exceptZero'))
    expect(table.text()).toContain('25 janv. 2027')
    expect(table.text()).toContain('Carte')
    expect(table.text()).toContain('Automatique')
    expect(wrapper.get('[data-testid="subscriptions-monthly"]').text()).toBe(
      euros(368),
    )
    expect(wrapper.get('[data-testid="subscriptions-annual"]').text()).toBe(
      euros(4_416),
    )
  })

  it('invites to mark a schedule as a subscription when there is none', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /subscriptions': () => ({
        subscriptions: [],
        totals: { monthlyCents: 0, annualCents: 0 },
      }),
    })

    const wrapper = await mountSuspended(SubscriptionsPage, {
      route: '/subscriptions',
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun abonnement')
    })
  })
})
