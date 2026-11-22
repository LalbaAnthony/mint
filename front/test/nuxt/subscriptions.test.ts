import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SubscriptionsPage from '~/pages/subscriptions/index.vue'
import { installFakeApi } from '../fake-api'
import {
  euros,
  referentialHandlers,
  schedule,
  setViewportWidth,
} from '../planning-fixtures'
import { mountInApp } from '../app'

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
  useAmountMaskStore().forget()
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

    const wrapper = await mountInApp(SubscriptionsPage, {
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

  it('masks the monthly and annual totals but keeps the subscriptions in clear in masked mode (DSH-05)', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /subscriptions': () => ({
        subscriptions: [schedule()],
        totals: { monthlyCents: 368, annualCents: 4_416 },
      }),
    })
    useAmountMaskStore().toggle()

    const wrapper = await mountInApp(SubscriptionsPage, {
      route: '/subscriptions',
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="subscriptions-table"]').exists()).toBe(
        true,
      )
    })
    for (const testId of ['subscriptions-monthly', 'subscriptions-annual']) {
      expect(
        wrapper.get(`[data-testid="${testId}"]`).attributes('data-masked'),
      ).toBe('true')
    }
    const totalCards = wrapper.get('[data-testid="subscription-totals"]').text()
    expect(totalCards).toContain('****')
    expect(totalCards).not.toContain(euros(368))
    expect(totalCards).not.toContain(euros(4_416))
    const table = wrapper.get('[data-testid="subscriptions-table"]').text()
    expect(table).toContain(euros(368))
    expect(table).toContain(euros(-4_416, 'exceptZero'))
  })

  it('invites to mark a schedule as a subscription when there is none', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /subscriptions': () => ({
        subscriptions: [],
        totals: { monthlyCents: 0, annualCents: 0 },
      }),
    })

    const wrapper = await mountInApp(SubscriptionsPage, {
      route: '/subscriptions',
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun abonnement')
    })
  })
})
