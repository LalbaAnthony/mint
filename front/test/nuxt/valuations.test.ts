import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@mint/shared/types/accounts'
import AccountGroupCard from '~/components/AccountGroupCard.vue'
import ValuationsModal from '~/components/ValuationsModal.vue'
import { valuationChartOption, valuationSeries } from '~/charts/valuations'
import { installFakeApi } from '../fake-api'
import {
  account,
  euros,
  fillInput,
  findInBody,
  referentialHandlers,
  submit,
} from '../planning-fixtures'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []
const valuationId = '00000000-0000-4000-8000-0000000000e8'

const usSummary = {
  paidInCents: 220_000,
  referenceBalanceCents: 253_000,
  lastValuation: { date: '2026-11-30', valueCents: 253_000 },
  latentGainCents: 33_000,
}

function pea(overrides: Partial<Account> = {}): Account {
  return account({
    name: 'PEA',
    nature: 'securities_account',
    usage: 'investment',
    currentBalanceCents: 253_000,
    investment: usSummary,
    ...overrides,
  })
}

function percent(ratio: number): string {
  return new Intl.NumberFormat('fr', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(ratio)
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('investments (CPT-06, US-16)', () => {
  it('shows the latent gain of +330 EUR (+15.0 %) under the reference balance and offers the valuations', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const wrapper = await mountInApp(AccountGroupCard, {
      props: {
        group: {
          usage: 'investment',
          subtotalCents: 253_000,
          accounts: [pea()],
        },
        paymentMethods: [],
        reordering: false,
        expandedIds: [],
      },
    })
    mounted.push(wrapper)

    expect(wrapper.get('[data-testid="account-balance"]').text()).toBe(
      euros(253_000),
    )
    const gain = wrapper.get('[data-testid="investment-gain"]')
    expect(gain.text()).toContain(euros(33_000, 'exceptZero'))
    expect(gain.get('[data-testid="investment-gain-percent"]').text()).toBe(
      `(${percent(0.15)})`,
    )
    expect(
      gain.get('[data-testid="money-amount"]').attributes('data-state'),
    ).toBe('credit')
    const items: unknown = wrapper
      .getComponent({ name: 'UDropdownMenu' })
      .props('items')
    expect(JSON.stringify(items)).toContain('Valorisations')
  })

  it('shows no gain nor valuation entry for a current account', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const wrapper = await mountInApp(AccountGroupCard, {
      props: {
        group: { usage: 'current', subtotalCents: 0, accounts: [account()] },
        paymentMethods: [],
        reordering: false,
        expandedIds: [],
      },
    })
    mounted.push(wrapper)

    expect(wrapper.find('[data-testid="investment-gain"]').exists()).toBe(false)
    const items: unknown = wrapper
      .getComponent({ name: 'UDropdownMenu' })
      .props('items')
    expect(JSON.stringify(items)).not.toContain('Valorisations')
  })

  it('shows the paid-in total, the latest valuation and records a new one in cents', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /accounts/${pea().id}/valuations`]: () => ({
        valuations: [
          {
            id: valuationId,
            accountId: pea().id,
            date: '2026-11-30',
            valueCents: 253_000,
          },
        ],
        summary: usSummary,
      }),
      [`POST /accounts/${pea().id}/valuations`]: () => ({
        id: '00000000-0000-4000-8000-0000000000e7',
        accountId: pea().id,
        date: '2026-12-01',
        valueCents: 260_050,
      }),
    })
    const wrapper = await mountInApp(ValuationsModal, {
      props: { open: true, account: pea() },
    })
    mounted.push(wrapper)

    await vi.waitFor(
      () => {
        expect(
          findInBody('[data-testid="valuation-paid-in"]')?.textContent,
        ).toBe(euros(220_000))
      },
      { timeout: 10_000 },
    )
    expect(
      findInBody('[data-testid="valuation-summary"]')?.textContent,
    ).toContain(euros(253_000))
    expect(findInBody('[data-testid="valuation-2026-11-30"]')).not.toBeNull()

    await fillInput('[data-testid="valuation-value"]', '2 600,50')
    submit('[data-testid="valuation-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({ date: parisDate(new Date()), valueCents: 260_050 })
    })
    await vi.waitFor(() => {
      expect(
        wrapper.getComponent(ValuationsModal).emitted('changed'),
      ).toBeDefined()
    })
  })

  it('plots the valuations by date in the investment colour (CHG-76)', () => {
    const valuations = [
      { id: 'b', accountId: 'pea', date: '2026-11-30', valueCents: 253_000 },
      { id: 'a', accountId: 'pea', date: '2026-11-10', valueCents: 160_000 },
    ]

    expect(valuationSeries(valuations)).toEqual([
      ['2026-11-10', 160_000],
      ['2026-11-30', 253_000],
    ])
    const option = valuationChartOption({
      valuations,
      theme: {
        needs: '#000000',
        wants: '#000000',
        save: '#000000',
        needsShades: [],
        wantsShades: [],
        balance: '#000000',
        investment: '#7c3aed',
        threshold: '#000000',
        negative: '#000000',
        income: '#000000',
        expense: '#000000',
        net: '#000000',
        textMuted: '#000000',
        borderMuted: '#000000',
        border: '#000000',
        background: '#ffffff',
        text: '#000000',
        fontFamily: 'Manrope',
      },
      label: 'Valorisation',
      animate: false,
      formatters: {
        money: String,
        axisDate: String,
        longDate: String,
      },
    })
    expect(option.series).toEqual([
      expect.objectContaining({
        showSymbol: true,
        itemStyle: { color: '#7c3aed', decal: { symbol: 'none' } },
      }),
    ])
  })
})
