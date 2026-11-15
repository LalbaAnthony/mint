import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EnvelopeCard from '~/components/EnvelopeCard.vue'
import EnvelopesPage from '~/pages/envelopes/index.vue'
import { installFakeApi } from '../fake-api'
import {
  envelopeLine,
  envelopeMonth,
  euros,
  referentialHandlers,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

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
    const wrapper = await mountSuspended(EnvelopeCard, {
      props: { line: envelopeLine(31_000), currentMonth: true },
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

describe('envelopes view (ENV-06)', () => {
  it('shows the consumption, the available amount and its share per remaining day (US-11)', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /envelopes': () => envelopeMonth([envelopeLine(12_000)]),
    })

    const wrapper = await mountSuspended(EnvelopesPage, { route: '/envelopes' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="envelopes-list"]').exists()).toBe(true)
    })
    expect(wrapper.get('[data-testid="envelopes-month"]').text()).toBe(
      'novembre 2026',
    )
    expect(wrapper.text()).toContain('20 jours restants dans le mois')
    expect(wrapper.get('[data-testid="envelope-consumed"]').text()).toBe(
      `${euros(12_000)} sur ${euros(30_000)}`,
    )
    expect(wrapper.get('[data-testid="envelope-available"]').text()).toBe(
      euros(18_000),
    )
    expect(wrapper.get('[data-testid="envelope-per-day"]').text()).toBe(
      euros(900),
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
