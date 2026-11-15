import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CategoryDeleteModal from '~/components/CategoryDeleteModal.vue'
import AccountsPage from '~/pages/accounts/index.vue'
import { installFakeApi } from '../fake-api'
import {
  account,
  card,
  categories,
  findInBody,
  ids,
  overview,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

function confirmButton(): HTMLButtonElement | null {
  const button = findInBody('[data-testid="confirm-modal-confirm"]')
  return button instanceof HTMLButtonElement ? button : null
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

describe('CPT-07 account deletion', () => {
  it('blocks the deletion of an account with operations and says to archive it', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => overview([account()]),
      'GET /payment-methods': () => [card],
      [`GET /accounts/${ids.current}/usage`]: () => ({
        operations: 3,
        schedules: 0,
        envelopes: 0,
      }),
    })
    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.findComponent({ name: 'AccountGroupCard' }).exists()).toBe(
        true,
      )
    })

    wrapper
      .getComponent({ name: 'AccountGroupCard' })
      .vm.$emit('accountAction', { kind: 'delete', account: account() })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        "Compte courant a des opérations : il ne peut qu'être archivé.",
      )
    })
    expect(confirmButton()?.disabled).toBe(true)
  })

  it('names the schedules and envelopes that still use a payment method', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => overview([account()]),
      'GET /payment-methods': () => [card],
      [`GET /payment-methods/${ids.card}/usage`]: () => ({
        operations: 0,
        schedules: 2,
        envelopes: 1,
      }),
    })
    const wrapper = await mountSuspended(AccountsPage, { route: '/accounts' })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.findComponent({ name: 'AccountGroupCard' }).exists()).toBe(
        true,
      )
    })

    wrapper
      .getComponent({ name: 'AccountGroupCard' })
      .vm.$emit('paymentMethodAction', { kind: 'delete', paymentMethod: card })

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        'Carte CA ne peut pas être supprimé : 2 échéances, 1 enveloppe',
      )
    })
    expect(confirmButton()?.disabled).toBe(true)
  })
})

describe('CAT-07 category deletion', () => {
  async function mountModal(usage: object, handlers = {}) {
    const api = installFakeApi(fetchMock, {
      [`GET /categories/${ids.groceries}/usage`]: () => usage,
      ...handlers,
    })
    const groceries = categories[0]
    const wrapper = await mountSuspended(CategoryDeleteModal, {
      props: { open: true, category: groceries ?? null, categories },
    })
    mounted.push(wrapper)
    return { api, wrapper }
  }

  it('requires a replacement of the same kind for a used category', async () => {
    const { wrapper } = await mountModal({
      operations: 4,
      schedules: 1,
      envelopes: 1,
    })

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="category-replacement"]')).not.toBeNull()
    })
    expect(document.body.textContent).toContain(
      'Elle est utilisée par 4 opérations, 1 échéance, 1 enveloppe',
    )
    expect(confirmButton()?.disabled).toBe(true)
    expect(wrapper.emitted('deleted')).toBeUndefined()
  })

  it('deletes an unused category directly', async () => {
    const { api, wrapper } = await mountModal(
      { operations: 0, schedules: 0, envelopes: 0 },
      { [`DELETE /categories/${ids.groceries}`]: () => undefined },
    )
    await vi.waitFor(() => {
      expect(confirmButton()?.disabled).toBe(false)
    })

    confirmButton()?.click()

    await vi.waitFor(() => {
      expect(wrapper.emitted('deleted')).toHaveLength(1)
    })
    expect(
      api.requests.find((request) => request.method === 'DELETE')?.path,
    ).toBe(`/categories/${ids.groceries}`)
  })
})
