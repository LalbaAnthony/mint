import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import CapExcessBadge from '~/components/CapExcessBadge.vue'
import MoneyAmount from '~/components/MoneyAmount.vue'
import ViewPanel from '~/components/ViewPanel.vue'
import { amountMaskStorageKey } from '~/stores/amount-mask'
import { signIn, signOut } from '../session'

function euros(cents: number, signDisplay: 'auto' | 'exceptZero' = 'auto') {
  return new Intl.NumberFormat('fr', {
    style: 'currency',
    currency: 'EUR',
    signDisplay,
  }).format(cents / 100)
}

function masked(cents: number, signDisplay: 'auto' | 'exceptZero' = 'auto') {
  const sign = new Intl.NumberFormat('fr', {
    style: 'currency',
    currency: 'EUR',
    signDisplay,
  })
    .formatToParts(cents / 100)
    .filter((part) => part.type === 'minusSign' || part.type === 'plusSign')
    .map((part) => part.value)
    .join('')
  return `${sign}****`
}

const mounted: { unmount: () => void }[] = []

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  vi.restoreAllMocks()
  useAmountMaskStore().forget()
  useToast().clear()
  window.localStorage.clear()
})

async function renderAmount(props: {
  cents: number
  variant?: 'balance' | 'flow'
  threshold?: number | null
  concealable?: boolean
}) {
  const wrapper = await mountSuspended(MoneyAmount, { props })
  mounted.push(wrapper)
  return wrapper.get('[data-testid="money-amount"]')
}

describe('masked mode state (DSH-05, ADR 0031)', () => {
  it('shows the amounts by default and remembers the masked mode on the device', () => {
    const store = useAmountMaskStore()

    expect(store.masked).toBe(false)
    expect(window.localStorage.getItem(amountMaskStorageKey)).toBeNull()

    store.toggle()

    expect(store.masked).toBe(true)
    expect(window.localStorage.getItem(amountMaskStorageKey)).toBe('1')

    store.toggle()

    expect(store.masked).toBe(false)
    expect(window.localStorage.getItem(amountMaskStorageKey)).toBeNull()
  })

  it('forgets the masked mode when the session ends', () => {
    const store = useAmountMaskStore()
    store.toggle()

    signOut()

    expect(store.masked).toBe(false)
    expect(window.localStorage.getItem(amountMaskStorageKey)).toBeNull()
    signIn()
  })

  it('follows a change made in another tab of the same device', () => {
    const store = useAmountMaskStore()

    window.dispatchEvent(
      new StorageEvent('storage', { key: amountMaskStorageKey, newValue: '1' }),
    )
    expect(store.masked).toBe(true)

    window.dispatchEvent(
      new StorageEvent('storage', {
        key: amountMaskStorageKey,
        newValue: null,
      }),
    )
    expect(store.masked).toBe(false)

    store.toggle()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))
    expect(store.masked).toBe(false)
  })

  it('keeps the mode for the page and warns when the device refuses to store it', async () => {
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError')
    })
    const store = useAmountMaskStore()

    store.toggle()

    expect(store.masked).toBe(true)
    expect(window.localStorage.getItem(amountMaskStorageKey)).toBeNull()
    await vi.waitFor(() => {
      expect(useToast().toasts.value.at(-1)).toMatchObject({
        title:
          "Le mode masqué n'a pas pu être mémorisé sur cet appareil : il ne durera que jusqu'au prochain rechargement.",
        color: 'error',
      })
    })
  })
})

describe('masked amount (DSH-05, CHG-45, CHG-60)', () => {
  it('replaces a concealable amount by **** and names it for screen readers', async () => {
    useAmountMaskStore().toggle()

    const amount = await renderAmount({ cents: 200_000, concealable: true })

    expect(amount.attributes('data-masked')).toBe('true')
    expect(amount.get('[aria-hidden="true"]').text()).toBe(masked(200_000))
    expect(amount.get('.sr-only').text()).toBe('montant masqué')
    expect(amount.text()).not.toContain(euros(200_000))
    expect(amount.classes()).toContain('tabular-nums')
    expect(amount.classes()).toContain('text-highlighted')
  })

  it('keeps the sign, the colour and the icon of the state', async () => {
    useAmountMaskStore().toggle()

    const negative = await renderAmount({
      cents: -1_000,
      threshold: 20_000,
      concealable: true,
    })
    const below = await renderAmount({
      cents: 15_000,
      threshold: 20_000,
      concealable: true,
    })
    const credit = await renderAmount({
      cents: 150_000,
      variant: 'flow',
      concealable: true,
    })
    const debit = await renderAmount({
      cents: -5_000,
      variant: 'flow',
      concealable: true,
    })

    expect(negative.attributes('data-state')).toBe('negative')
    expect(negative.classes()).toContain('text-error')
    expect(negative.find('.iconify').exists()).toBe(true)
    expect(negative.text()).toContain(masked(-1_000))
    expect(negative.text()).not.toContain(euros(-1_000))
    expect(below.classes()).toContain('text-warning')
    expect(below.text()).toContain("sous le seuil d'alerte")
    expect(below.text()).toContain(masked(15_000))
    expect(credit.classes()).toContain('text-success')
    expect(credit.text()).toContain(masked(150_000, 'exceptZero'))
    expect(debit.classes()).toContain('text-default')
    expect(debit.text()).toContain(masked(-5_000, 'exceptZero'))
  })

  it('leaves the amounts that are not concealable in clear', async () => {
    useAmountMaskStore().toggle()

    const amount = await renderAmount({ cents: -5_000, variant: 'flow' })

    expect(amount.attributes('data-masked')).toBe('false')
    expect(amount.text()).toBe(euros(-5_000, 'exceptZero'))
  })

  it('shows the amount again as soon as the mode is turned off', async () => {
    const store = useAmountMaskStore()
    store.toggle()
    const amount = await renderAmount({ cents: 200_000, concealable: true })

    store.toggle()
    await nextTick()

    expect(amount.text()).toBe(euros(200_000))
  })

  it('masks the cap excess badge of a summary only', async () => {
    useAmountMaskStore().toggle()

    const summary = await mountSuspended(CapExcessBadge, {
      props: { excessCents: 5_000, concealable: true },
    })
    const detail = await mountSuspended(CapExcessBadge, {
      props: { excessCents: 5_000 },
    })
    mounted.push(summary, detail)

    expect(summary.text()).toContain('dépasse le plafond de ****')
    expect(summary.text()).toContain('dépasse le plafond de montant masqué')
    expect(summary.text()).not.toContain(euros(5_000))
    expect(detail.text()).toBe(`dépasse le plafond de ${euros(5_000)}`)
  })
})

describe('eye button of the header (DSH-05, CHG-45)', () => {
  it('toggles the masked mode from the header of every view', async () => {
    const wrapper = await mountSuspended(ViewPanel, {
      props: { title: 'Accueil' },
    })
    mounted.push(wrapper)
    const button = wrapper.get('[data-testid="amount-mask-toggle"]')

    expect(button.attributes('aria-label')).toBe('Masquer les montants')
    expect(button.attributes('title')).toBe('Masquer les montants')
    expect(button.attributes('aria-pressed')).toBe('false')
    expect(
      button.element.compareDocumentPosition(
        wrapper.get('[data-testid="notification-bell"]').element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    await button.trigger('click')

    expect(useAmountMaskStore().masked).toBe(true)
    expect(button.attributes('aria-pressed')).toBe('true')
    expect(button.attributes('aria-label')).toBe('Masquer les montants')

    await button.trigger('click')

    expect(useAmountMaskStore().masked).toBe(false)
    expect(button.attributes('aria-pressed')).toBe('false')
  })
})
