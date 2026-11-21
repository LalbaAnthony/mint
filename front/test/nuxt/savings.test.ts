import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Account } from '@mint/shared/types/accounts'
import AccountFormModal from '~/components/AccountFormModal.vue'
import AccountGroupCard from '~/components/AccountGroupCard.vue'
import CalendarOccurrenceMenu from '~/components/CalendarOccurrenceMenu.vue'
import InterestModal from '~/components/InterestModal.vue'
import RegulatedCapsCard from '~/components/RegulatedCapsCard.vue'
import { installFakeApi } from '../fake-api'
import {
  account,
  euros,
  fillInput,
  findInBody,
  ids,
  referentialHandlers,
  submit,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []
const rateId = '00000000-0000-4000-8000-0000000000e6'

const caps = [
  { product: 'livret_a', capCents: 2_295_000 },
  { product: 'lep', capCents: 1_000_000 },
]

function lep(overrides: Partial<Account> = {}): Account {
  return account({
    id: ids.livret,
    name: 'LEP',
    nature: 'regulated_savings',
    regulatedProduct: 'lep',
    usage: 'emergency',
    currentBalanceCents: 1_005_000,
    depositCapCents: 1_000_000,
    capitalizedInterestCents: 0,
    interestMethod: 'fortnight',
    capitalization: 'dec31',
    depositCapExcessCents: 5_000,
    interest: {
      annualRatePct: 2.7,
      periodStart: '2026-01-01',
      acquiredCents: 12_345,
      nextCapitalizationDate: '2026-12-31',
      projectedCents: 15_000,
    },
    ...overrides,
  })
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

describe('savings caps and interest (LIV-01 to LIV-04)', () => {
  it('flags an account over its cap and shows its estimated interest (CHG-61)', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const wrapper = await mountSuspended(AccountGroupCard, {
      props: {
        group: { usage: 'emergency', subtotalCents: 0, accounts: [lep()] },
        paymentMethods: [],
        reordering: false,
        expandedIds: [],
      },
    })
    mounted.push(wrapper)

    expect(wrapper.get('[data-testid="cap-excess"]').text()).toBe(
      `dépasse le plafond de ${euros(5_000)}`,
    )
    expect(wrapper.get('[data-testid="account-interest"]').text()).toContain(
      euros(12_345, 'exceptZero'),
    )
    const items: unknown = wrapper
      .getComponent({ name: 'UDropdownMenu' })
      .props('items')
    expect(JSON.stringify(items)).toContain('Taux et intérêts')
  })

  it('prefills the cap of the chosen product and sends the savings settings', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /regulated-caps': () => caps,
      'POST /accounts': () => lep(),
    })
    const wrapper = await mountSuspended(AccountFormModal, {
      props: { open: true, account: null },
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="account-form"]')).not.toBeNull()
    })

    await fillInput('[data-testid="account-name-input"]', 'LEP')
    const nature = wrapper.findAllComponents({ name: 'USelect' })[0]
    nature?.vm.$emit('update:modelValue', 'regulated_savings')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="account-product"]')).not.toBeNull()
    })
    const product = wrapper
      .findAllComponents({ name: 'USelect' })
      .find((select) => JSON.stringify(select.props('items')).includes('lep'))
    product?.vm.$emit('update:modelValue', 'lep')
    await vi.waitFor(() => {
      const input =
        findInBody('[data-testid="account-deposit-cap"] input') ??
        findInBody('[data-testid="account-deposit-cap"]')
      expect(input instanceof HTMLInputElement && input.value).toBe(
        new Intl.NumberFormat('fr', { minimumFractionDigits: 2 }).format(
          10_000,
        ),
      )
    })
    await fillInput('[data-testid="account-initial-balance"]', '9 950')
    submit('[data-testid="account-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual(
        expect.objectContaining({
          nature: 'regulated_savings',
          regulatedProduct: 'lep',
          depositCapCents: 1_000_000,
          capitalizedInterestCents: 0,
          interestMethod: 'fortnight',
          capitalization: 'dec31',
          anniversaryDate: null,
        }),
      )
    })
  })

  it('shows the acquired and projected interest and records a rate typed with a comma', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /accounts/${ids.livret}/interest`]: () => ({
        rates: [
          {
            id: rateId,
            accountId: ids.livret,
            effectiveDate: '2025-08-01',
            annualRatePct: 2.7,
          },
        ],
        summary: lep().interest,
      }),
      [`POST /accounts/${ids.livret}/interest-rates`]: () => ({
        id: '00000000-0000-4000-8000-0000000000e5',
        accountId: ids.livret,
        effectiveDate: '2026-02-01',
        annualRatePct: 2.4,
      }),
    })
    const wrapper = await mountSuspended(InterestModal, {
      props: { open: true, account: lep() },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="interest-acquired"]')?.textContent).toBe(
        euros(12_345, 'exceptZero'),
      )
    })
    expect(findInBody('[data-testid="interest-projected"]')?.textContent).toBe(
      euros(15_000, 'exceptZero'),
    )
    expect(
      findInBody('[data-testid="interest-rate-2025-08-01"]'),
    ).not.toBeNull()

    await fillInput('[data-testid="interest-rate"]', '2,4')
    submit('[data-testid="interest-rate-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({ effectiveDate: parisDate(new Date()), annualRatePct: 2.4 })
    })
  })

  it('offers no menu on an interest occurrence managed by Mint', async () => {
    const wrapper = await mountSuspended(CalendarOccurrenceMenu, {
      props: {
        occurrence: {
          scheduleId: ids.schedule,
          kind: 'income',
          label: 'Intérêts',
          accountId: ids.livret,
          amountCents: 24_000,
          triggerMode: 'auto',
          isSubscription: false,
          system: true,
          capExcessCents: null,
          occurrence: {
            originalDate: '2026-12-31',
            effectiveDate: '2026-12-31',
            amountCents: 24_000,
            status: 'pending',
            overridden: false,
            editable: false,
          },
        },
      },
      slots: { default: () => 'Intérêts' },
    })
    mounted.push(wrapper)

    expect(wrapper.findComponent({ name: 'UDropdownMenu' }).exists()).toBe(
      false,
    )
    expect(wrapper.text()).toBe('Intérêts')
  })

  it('lets the administrator change a reference cap', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /regulated-caps': () => caps,
      'PATCH /admin/regulated-caps/lep': () => ({
        product: 'lep',
        capCents: 1_050_000,
      }),
    })
    const wrapper = await mountSuspended(RegulatedCapsCard)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="regulated-cap-lep"]').exists()).toBe(
        true,
      )
    })

    await wrapper
      .get('[data-testid="regulated-cap-lep"] input')
      .setValue('10 500')
    await wrapper.get('[data-testid="regulated-cap-save-lep"]').trigger('click')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'PATCH')?.body,
      ).toEqual({ capCents: 1_050_000 })
    })
  })
})
