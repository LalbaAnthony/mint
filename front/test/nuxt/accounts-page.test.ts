import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account, AccountOverview } from '@mint/shared/types/accounts'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import AccountsPage from '~/pages/accounts/index.vue'
import { installFakeApi } from '../fake-api'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

function euros(cents: number): string {
  return new Intl.NumberFormat('fr', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

function account(overrides: Partial<Account>): Account {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    name: 'Compte courant',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: 'Crédit Agricole',
    initialBalanceCents: 200_000,
    initialBalanceDate: '2026-11-11',
    lowBalanceThresholdCents: null,
    sortOrder: 0,
    archivedAt: null,
    currentBalanceCents: 200_000,
    reconciliationGapCents: null,
    ...overrides,
  }
}

const current = account({})
const lep = account({
  id: '00000000-0000-4000-8000-0000000000a2',
  name: 'LEP',
  nature: 'regulated_savings',
  regulatedProduct: 'lep',
  usage: 'emergency',
  institution: null,
  currentBalanceCents: 500_000,
})
const livretA = account({
  id: '00000000-0000-4000-8000-0000000000a3',
  name: 'Livret A',
  nature: 'regulated_savings',
  regulatedProduct: 'livret_a',
  usage: 'savings',
  currentBalanceCents: 1_200_000,
})

const usOverview: AccountOverview = {
  totalCents: 1_900_000,
  groups: [
    { usage: 'current', subtotalCents: 200_000, accounts: [current] },
    { usage: 'emergency', subtotalCents: 500_000, accounts: [lep] },
    { usage: 'savings', subtotalCents: 1_200_000, accounts: [livretA] },
  ],
  archived: [],
}

const card: PaymentMethod = {
  id: '00000000-0000-4000-8000-0000000000b1',
  label: 'Carte CA',
  kind: 'card',
  accountId: current.id,
  archivedAt: null,
}

const expiredCard: PaymentMethod = {
  ...card,
  id: '00000000-0000-4000-8000-0000000000b2',
  label: 'Ancienne carte',
  archivedAt: '2026-11-01T10:00:00.000Z',
}

function findInBody(selector: string): HTMLElement | null {
  return document.body.querySelector<HTMLElement>(selector)
}

async function fillInput(selector: string, value: string): Promise<void> {
  const input = findInBody(`${selector} input`) ?? findInBody(selector)
  if (!(input instanceof HTMLInputElement)) {
    throw new Error(`No input for ${selector}`)
  }
  input.value = value
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('US-04 where my money is (CPT-08)', () => {
  it('shows three groups with subtotals of 2 000, 5 000 and 12 000 EUR and a total of 19 000 EUR', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => usOverview,
      'GET /payment-methods': () => [card],
    })

    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="accounts-total"]').exists()).toBe(true)
    })
    expect(wrapper.get('[data-testid="accounts-total"]').text()).toContain(
      euros(1_900_000),
    )
    const groups = wrapper.findAll('[data-testid^="usage-group-"]')
    expect(
      groups.map((group) => [
        group.attributes('data-testid'),
        group.get('[data-testid="usage-subtotal"]').text(),
      ]),
    ).toEqual([
      ['usage-group-current', euros(200_000)],
      ['usage-group-emergency', euros(500_000)],
      ['usage-group-savings', euros(1_200_000)],
    ])
    expect(groups[0]?.text()).toContain('Courant')
    expect(groups[1]?.text()).toContain('Épargne de précaution')
    expect(groups[1]?.text()).toContain('Livret réglementé (LEP)')
    expect(groups[0]?.text()).toContain(
      'Compte courant · Crédit Agricole · 1 moyen de paiement',
    )
    expect(groups[0]?.find('.bg-data-current').exists()).toBe(true)
  })

  it('flags a balance below its alert threshold (CHG-20)', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({
        totalCents: 15_000,
        groups: [
          {
            usage: 'current',
            subtotalCents: 15_000,
            accounts: [
              account({
                currentBalanceCents: 15_000,
                lowBalanceThresholdCents: 20_000,
              }),
            ],
          },
        ],
        archived: [],
      }),
      'GET /payment-methods': () => [],
    })

    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })

    await vi.waitFor(() => {
      expect(
        wrapper.get('[data-testid="account-balance"]').attributes('data-state'),
      ).toBe('belowThreshold')
    })
  })

  it('shows the empty state without any account (CHG-66)', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({
        totalCents: 0,
        groups: [],
        archived: [],
      }),
      'GET /payment-methods': () => [],
    })

    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun compte')
    })
    expect(wrapper.find('[data-testid="accounts-total"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="accounts-reorder"]').exists()).toBe(
      false,
    )
  })

  it('lists archived accounts in a collapsed section, outside the groups (CPT-07)', async () => {
    const archived = account({
      id: '00000000-0000-4000-8000-0000000000a9',
      name: 'Compte Revolut',
      archivedAt: '2026-11-01T10:00:00.000Z',
      currentBalanceCents: 0,
    })
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({ ...usOverview, archived: [archived] }),
      'GET /payment-methods': () => [],
    })

    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="archived-accounts"]').exists()).toBe(
        true,
      )
    })
    const section = wrapper.get('[data-testid="archived-accounts"]')
    expect(section.text()).toContain('Comptes archivés (1)')
    expect(section.text()).not.toContain('Compte Revolut')

    await section
      .get('[data-testid="archived-accounts-toggle"]')
      .trigger('click')

    await vi.waitFor(() => {
      expect(section.text()).toContain('Compte Revolut')
    })
    expect(section.text()).toContain('Archivé')
  })
})

describe('payment methods under their account (PAY-01, PAY-05)', () => {
  it('unfolds the payment methods of an account, archived ones with a badge', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => usOverview,
      'GET /payment-methods': () => [card, expiredCard],
    })
    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })
    await vi.waitFor(() => {
      expect(
        wrapper.find(`[data-testid="account-${current.id}"]`).exists(),
      ).toBe(true)
    })
    const row = wrapper.get(`[data-testid="account-${current.id}"]`)
    expect(
      row.find(`[data-testid="payment-methods-${current.id}"]`).exists(),
    ).toBe(false)

    await row.get('[data-testid="account-toggle"]').trigger('click')

    const list = row.get(`[data-testid="payment-methods-${current.id}"]`)
    expect(list.text()).toContain('Carte CA')
    expect(list.text()).toContain('Carte bancaire')
    expect(
      list.get(`[data-testid="payment-method-${expiredCard.id}"]`).text(),
    ).toContain('Archivé')
  })

  it('creates a payment method on the unfolded account', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /accounts/overview': () => usOverview,
      'GET /payment-methods': () => [],
      'POST /payment-methods': () => ({ ...card, label: 'Virement CA' }),
    })
    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="account-toggle"]').exists()).toBe(true)
    })
    await wrapper.get('[data-testid="account-toggle"]').trigger('click')

    await wrapper.get('[data-testid="add-payment-method"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="payment-method-form"]')).not.toBeNull()
    })
    await fillInput('[data-testid="payment-method-label"]', 'Virement CA')
    findInBody('[data-testid="payment-method-form"]')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({ label: 'Virement CA', kind: 'card', accountId: current.id })
    })
  })
})

describe('account form (CPT-01)', () => {
  it('creates an account with amounts typed in euros and sent in cents', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({
        totalCents: 0,
        groups: [],
        archived: [],
      }),
      'GET /payment-methods': () => [],
      'POST /accounts': () => current,
    })
    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun compte')
    })

    await wrapper.get('[data-testid="accounts-add"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="account-form"]')).not.toBeNull()
    })
    await fillInput('[data-testid="account-name-input"]', 'Compte courant')
    await fillInput('[data-testid="account-initial-balance"]', '2 000,50')
    await fillInput('[data-testid="account-threshold"]', '200')
    findInBody('[data-testid="account-form"]')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({
        name: 'Compte courant',
        nature: 'current_account',
        regulatedProduct: null,
        usage: 'current',
        institution: null,
        initialBalanceCents: 200_050,
        initialBalanceDate: parisDate(new Date()),
        lowBalanceThresholdCents: 20_000,
      })
    })
  })

  it('refuses an amount that is not a number', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({
        totalCents: 0,
        groups: [],
        archived: [],
      }),
      'GET /payment-methods': () => [],
    })
    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun compte')
    })
    await wrapper.get('[data-testid="accounts-add"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="account-form"]')).not.toBeNull()
    })

    await fillInput('[data-testid="account-name-input"]', 'Compte')
    await fillInput('[data-testid="account-initial-balance"]', 'deux mille')
    findInBody('[data-testid="account-form"]')?.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="account-form"]')?.textContent).toContain(
        'Montant invalide',
      )
    })
    expect(api.requests.some((request) => request.method === 'POST')).toBe(
      false,
    )
  })
})

describe('reorder mode (CPT-01)', () => {
  it('moves an account down inside its usage and saves the order', async () => {
    const second = account({
      id: '00000000-0000-4000-8000-0000000000a4',
      name: 'Compte Revolut',
      sortOrder: 1,
    })
    const api = installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({
        totalCents: 400_000,
        groups: [
          {
            usage: 'current',
            subtotalCents: 400_000,
            accounts: [current, second],
          },
        ],
        archived: [],
      }),
      'GET /payment-methods': () => [],
      'POST /accounts/reorder': () => undefined,
    })
    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="accounts-reorder"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.find('[data-testid="move-down"]').exists()).toBe(false)

    await wrapper.get('[data-testid="accounts-reorder"]').trigger('click')
    const firstRow = wrapper.get(`[data-testid="account-${current.id}"]`)
    expect(firstRow.find('[data-drag-handle="account"]').exists()).toBe(true)
    expect(
      firstRow.get('[data-testid="move-up"]').attributes('disabled'),
    ).toBeDefined()
    await firstRow.get('[data-testid="move-down"]').trigger('click')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.path === '/accounts/reorder')
          ?.body,
      ).toEqual({ usage: 'current', accountIds: [second.id, current.id] })
    })
  })
})
