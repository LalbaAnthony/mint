import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { UApp } from '#components'
import EnvelopeConsumption from '~/components/EnvelopeConsumption.vue'
import EnvelopeMonthAmountModal from '~/components/EnvelopeMonthAmountModal.vue'
import EnvelopesPage from '~/pages/envelopes/index.vue'
import { installFakeApi } from '../fake-api'
import {
  envelopeLine,
  envelopeMonth,
  euros,
  fillInput,
  findInBody,
  ids,
  referentialHandlers,
  setViewportWidth,
  submit,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const initialWidth = window.innerWidth
const mounted: { unmount: () => void }[] = []

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

function inApp(component: object) {
  return defineComponent({
    setup() {
      return () => h(UApp, null, { default: () => h(component) })
    },
  })
}

function secondLine() {
  const line = envelopeLine(12_500, {
    budgetCents: 10_000,
    availableCents: -2_500,
    availablePerDayCents: 0,
  })
  return {
    ...line,
    envelope: {
      ...line.envelope,
      id: '00000000-0000-4000-8000-0000000000f3',
      label: 'Sorties',
      monthlyAmountCents: 10_000,
    },
  }
}

describe('envelope tones (CHG-64, CA-06)', () => {
  it.each([
    [24_000, 'primary'],
    [24_001, 'warning'],
    [30_000, 'warning'],
    [30_001, 'error'],
  ])('colours %i cents consumed out of 300 EUR in %s', (consumed, tone) => {
    expect(envelopeTone(consumed, 30_000)).toBe(tone)
  })

  it('caps the progress at 100 % and shows the overrun', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const wrapper = await mountSuspended(EnvelopeConsumption, {
      props: { status: envelopeLine(31_000).status },
    })
    mounted.push(wrapper)

    expect(envelopeProgress(31_000, 30_000)).toBe(100)
    expect(
      wrapper.get('[data-testid="envelope-progress"]').attributes('data-tone'),
    ).toBe('error')
    expect(wrapper.get('[data-testid="envelope-overrun"]').text()).toContain(
      euros(1_000),
    )
  })
})

describe('envelopes view (ENV-06, ENV-08)', () => {
  it('shows one table line per envelope and the totals of the month (US-11)', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /envelopes': () =>
        envelopeMonth([envelopeLine(12_000), secondLine()]),
    })

    const wrapper = await mountSuspended(EnvelopesPage, { route: '/envelopes' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="envelopes-table"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.get('[data-testid="envelopes-month"]').text()).toBe(
      'novembre 2026',
    )
    expect(wrapper.text()).toContain('20 jours restants dans le mois')
    expect(wrapper.findAll('tbody tr[data-slot="tr"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="envelopes-totals-row"] th').text()).toBe(
      'Total',
    )
    expect(wrapper.get('[data-testid="envelope-consumed"]').text()).toBe(
      `${euros(12_000)} sur ${euros(30_000)}`,
    )
    expect(wrapper.get('[data-testid="envelope-available"]').text()).toBe(
      euros(18_000),
    )
    expect(wrapper.get('[data-testid="envelope-per-day"]').text()).toBe(
      euros(900),
    )
    expect(wrapper.get('[data-testid="envelopes-total-budget"]').text()).toBe(
      euros(40_000),
    )
    expect(wrapper.get('[data-testid="envelopes-total-consumed"]').text()).toBe(
      euros(24_500),
    )
    expect(
      wrapper.get('[data-testid="envelopes-total-available"]').text(),
    ).toBe(euros(15_500))
  })

  it('lists the envelopes in rows with their totals under 1024 px', async () => {
    setViewportWidth(390)
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /envelopes': () =>
        envelopeMonth([envelopeLine(12_000), secondLine()]),
    })

    const wrapper = await mountSuspended(EnvelopesPage, { route: '/envelopes' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="envelopes-totals"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.find('[data-testid="envelopes-table"]').exists()).toBe(false)
    expect(
      wrapper.find(`[data-testid="envelope-${ids.envelope}"]`).exists(),
    ).toBe(true)
    expect(
      wrapper
        .get(
          '[data-testid="envelopes-totals"] [data-testid="envelopes-total-available"]',
        )
        .text(),
    ).toBe(euros(15_500))
  })

  it('flags an amount specific to the month (ENV-07)', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /envelopes': () =>
        envelopeMonth([
          envelopeLine(0, {
            budgetCents: 45_000,
            overridden: true,
            availableCents: 45_000,
          }),
        ]),
    })

    const wrapper = await mountSuspended(inApp(EnvelopesPage), {
      route: '/envelopes',
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="envelope-overridden"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.get('[data-testid="envelope-overridden"]').text()).toBe(
      `Exception Montant mensuel : ${euros(30_000)}`,
    )
    expect(wrapper.get('[data-testid="envelope-budget"]').text()).toBe(
      euros(45_000),
    )
  })

  it('navigates to the next month', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /envelopes': () => envelopeMonth([envelopeLine(0)]),
      'GET /envelopes?month=2026-12-01': () =>
        envelopeMonth([envelopeLine(0)], '2026-12-01'),
    })
    const wrapper = await mountSuspended(EnvelopesPage, { route: '/envelopes' })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="envelopes-next"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="envelopes-next"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="envelope-per-day"]').exists()).toBe(
        false,
      )
    })
    expect(wrapper.get('[data-testid="envelopes-month"]').text()).toBe(
      'décembre 2026',
    )
    expect(api.requests.map((request) => request.path)).toContain(
      '/envelopes?month=2026-12-01',
    )
  })
})

describe('amount of one month (ENV-07)', () => {
  const monthPath = `/envelopes/${ids.envelope}/months/2026-12-01`

  it('saves an amount of zero for the month', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`POST ${monthPath}`]: () => ({
        envelopeId: ids.envelope,
        month: '2026-12-01',
        amountCents: 0,
      }),
    })
    const wrapper = await mountSuspended(EnvelopeMonthAmountModal, {
      props: { open: true, line: envelopeLine(0), month: '2026-12-01' },
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="envelope-month-form"]')).not.toBeNull()
    })
    expect(document.body.textContent).toContain('Montant pour décembre 2026')
    expect(findInBody('[data-testid="envelope-month-restore"]')).toBeNull()

    await fillInput('[data-testid="envelope-month-amount"]', '0')
    submit('[data-testid="envelope-month-form"]')

    await vi.waitFor(() => {
      expect(wrapper.emitted('saved')).toEqual([['Courses']])
    })
    expect(api.requests.find((request) => request.path === monthPath)).toEqual(
      expect.objectContaining({ method: 'POST', body: { amountCents: 0 } }),
    )
  })

  it('goes back to the monthly amount', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`DELETE ${monthPath}`]: () => null,
    })
    const wrapper = await mountSuspended(EnvelopeMonthAmountModal, {
      props: {
        open: true,
        line: envelopeLine(0, { budgetCents: 0, overridden: true }),
        month: '2026-12-01',
      },
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="envelope-month-restore"]'),
      ).not.toBeNull()
    })

    findInBody('[data-testid="envelope-month-restore"]')?.click()

    await vi.waitFor(() => {
      expect(wrapper.emitted('saved')).toEqual([['Courses']])
    })
    expect(api.requests.map((request) => request.method)).toContain('DELETE')
  })
})
