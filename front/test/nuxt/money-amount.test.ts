import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import MoneyAmount from '~/components/MoneyAmount.vue'

function euros(cents: number, signDisplay: 'auto' | 'exceptZero' = 'auto') {
  return new Intl.NumberFormat('fr', {
    style: 'currency',
    currency: 'EUR',
    signDisplay,
  }).format(cents / 100)
}

async function render(props: {
  cents: number
  variant?: 'balance' | 'flow'
  threshold?: number | null
}) {
  const wrapper = await mountSuspended(MoneyAmount, { props })
  return wrapper.get('[data-testid="money-amount"]')
}

describe('MoneyAmount (CHG-20, CHG-60, CA-05)', () => {
  it('shows a positive balance with tabular figures and the highlighted color', async () => {
    const amount = await render({ cents: 200_000 })

    expect(amount.classes()).toContain('tabular-nums')
    expect(amount.classes()).toContain('text-highlighted')
    expect(amount.text()).toBe(euros(200_000))
    expect(amount.find('.iconify').exists()).toBe(false)
  })

  it('marks a positive balance below the alert threshold with a warning icon and text', async () => {
    const amount = await render({ cents: 15_000, threshold: 20_000 })

    expect(amount.attributes('data-state')).toBe('belowThreshold')
    expect(amount.classes()).toContain('text-warning')
    expect(amount.text()).toContain("sous le seuil d'alerte")
    expect(amount.text()).toContain(euros(15_000))
  })

  it('shows a negative balance in the error color with its sign, the negative state winning', async () => {
    const amount = await render({ cents: -1_000, threshold: 20_000 })

    expect(amount.attributes('data-state')).toBe('negative')
    expect(amount.classes()).toContain('text-error')
    expect(amount.text()).toBe(euros(-1_000))
  })

  it('shows a credit flow in the success color with its sign and a debit in the default color', async () => {
    const credit = await render({ cents: 150_000, variant: 'flow' })
    const debit = await render({ cents: -5_000, variant: 'flow' })

    expect(credit.classes()).toContain('text-success')
    expect(credit.text()).toBe(euros(150_000, 'exceptZero'))
    expect(debit.classes()).toContain('text-default')
    expect(debit.text()).toBe(euros(-5_000, 'exceptZero'))
  })
})
