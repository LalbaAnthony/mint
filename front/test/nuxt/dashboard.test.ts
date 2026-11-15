import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BalanceCurvePoint,
  BalanceCurveResponse,
} from '@mint/shared/types/forecast'
import { balanceCurveOption, balanceCurveSeries } from '~/charts/balance-curve'
import { toSrgbHex } from '~/charts/theme'
import DashboardPage from '~/pages/index.vue'
import type { ChartTheme } from '~~/types/forecast'
import { installFakeApi } from '../fake-api'
import { euros, ids, referentialHandlers } from '../planning-fixtures'

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

const theme: ChartTheme = {
  balance: '#3d853c',
  threshold: '#d97706',
  negative: '#dc2626',
  income: '#059669',
  expense: '#7c7c6e',
  net: '#3a3a30',
  textMuted: '#6b6b5f',
  borderMuted: '#ececE6',
  border: '#dcdcd2',
  background: '#ffffff',
  text: '#3a3a30',
  fontFamily: 'Manrope',
}

function point(
  date: string,
  balanceCents: number | null,
  forecast: boolean,
): BalanceCurvePoint {
  return { date, balanceCents, forecast }
}

function curve(
  overrides: Partial<BalanceCurveResponse> = {},
): BalanceCurveResponse {
  return {
    today: '2026-11-11',
    accountId: null,
    thresholdCents: null,
    horizonMonths: 3,
    endDate: '2026-11-13',
    points: [
      point('2026-11-09', null, false),
      point('2026-11-10', 100_000, false),
      point('2026-11-11', 90_000, true),
      point('2026-11-12', -5_000, true),
      point('2026-11-13', 20_000, true),
    ],
    indicators: {
      minBalanceCents: -5_000,
      minBalanceDate: '2026-11-12',
      firstBelowThresholdDate: null,
      firstNegativeDate: '2026-11-12',
    },
    ...overrides,
  }
}

function optionOf(response: BalanceCurveResponse) {
  return balanceCurveOption({
    curve: response,
    theme,
    animate: true,
    labels: {
      real: 'Réel',
      forecast: 'Prévu',
      today: "Aujourd'hui",
      threshold: "Seuil d'alerte",
      minimum: 'Minimum',
    },
    formatters: {
      money: (cents) => `${Math.round(cents / 100)} €`,
      axisDate: (date) => date,
      longDate: (date) => date,
    },
  })
}

function seriesOf(response: BalanceCurveResponse) {
  const series = optionOf(response).series
  if (!Array.isArray(series)) {
    throw new Error('Two series expected')
  }
  return series
}

describe('balance curve option (DSH-01, CHG-73, CHG-24, CHG-77)', () => {
  it('draws the real days in a solid line and joins the dashed forecast at the last real day', () => {
    expect(balanceCurveSeries(curve().points)).toEqual({
      dates: [
        '2026-11-09',
        '2026-11-10',
        '2026-11-11',
        '2026-11-12',
        '2026-11-13',
      ],
      real: ['-', 100_000, '-', '-', '-'],
      forecast: ['-', 100_000, 90_000, -5_000, 20_000],
    })
    const [real, forecast] = seriesOf(curve())
    expect(real).toMatchObject({
      lineStyle: { type: 'solid', width: 2 },
      areaStyle: { opacity: 0.12 },
      itemStyle: { decal: { symbol: 'none' } },
    })
    expect(forecast).toMatchObject({
      lineStyle: { type: [6, 4], width: 2 },
      areaStyle: { opacity: 0.06 },
    })
    expect(optionOf(curve()).aria).toEqual({
      enabled: true,
      decal: { show: true },
    })
  })

  it('colours under zero as negative, and the threshold band only for an account', () => {
    expect(optionOf(curve()).visualMap).toMatchObject({
      pieces: [
        { lt: 0, color: theme.negative },
        { gte: 0, color: theme.balance },
      ],
    })
    const withThreshold = curve({
      accountId: ids.current,
      thresholdCents: 50_000,
    })
    expect(optionOf(withThreshold).visualMap).toMatchObject({
      pieces: [
        { lt: 0, color: theme.negative },
        { gte: 0, lt: 50_000, color: theme.threshold },
        { gte: 50_000, color: theme.balance },
      ],
    })
    const [, forecast] = seriesOf(withThreshold)
    expect(JSON.stringify(forecast)).toContain('"yAxis":50000')
    const [, aggregateForecast] = seriesOf(curve())
    expect(JSON.stringify(aggregateForecast)).not.toContain('"yAxis"')
  })

  it('annotates the minimum of the horizon and marks today', () => {
    const [, forecast] = seriesOf(curve())
    expect(forecast).toMatchObject({
      markPoint: {
        data: [{ coord: ['2026-11-12', -5_000] }],
        label: { formatter: 'Minimum\n2026-11-12\n-50 €' },
      },
      markLine: { data: [expect.objectContaining({ xAxis: '2026-11-11' })] },
    })
  })

  it('stops the animation when the user prefers reduced motion', () => {
    expect(
      balanceCurveOption({
        curve: curve(),
        theme,
        animate: false,
        labels: {
          real: '',
          forecast: '',
          today: '',
          threshold: '',
          minimum: '',
        },
        formatters: {
          money: String,
          axisDate: String,
          longDate: String,
        },
      }).animation,
    ).toBe(false)
  })

  it('falls back to the given colour when no canvas is available', () => {
    expect(toSrgbHex('')).toBe('#000000')
  })
})

describe('dashboard view (DSH-01)', () => {
  it('shows the forecast curve of all accounts with its minimum and the data table', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /forecast/curve?horizonMonths=3': () => curve(),
    })

    const wrapper = await mountSuspended(DashboardPage, {
      route: '/',
      global: { stubs: { Echarts: true } },
    })
    mounted.push(wrapper)

    await vi.waitFor(
      () => {
        expect(
          wrapper.find('[data-testid="balance-curve-chart"]').exists(),
        ).toBe(true)
      },
      { timeout: 10_000 },
    )
    expect(wrapper.get('[data-testid="dashboard-negative"]').text()).toContain(
      'Négatif à partir du',
    )
    expect(
      wrapper.find('[data-testid="dashboard-below-threshold"]').exists(),
    ).toBe(false)
    expect(wrapper.get('[data-testid="dashboard-minimum"]').text()).toContain(
      euros(-5_000),
    )
    await wrapper
      .get('[data-testid="balance-curve-show-data"]')
      .trigger('click')
    const table = wrapper.get('[data-testid="balance-curve-table"]')
    expect(table.text()).toContain(euros(100_000))
    expect(table.text()).toContain('Prévu')
    expect(table.text()).toContain('Réel')
    expect(api.requests.map((request) => request.path)).toContain(
      '/forecast/curve?horizonMonths=3',
    )
  })

  it('invites to create an account when there is none', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /accounts/overview': () => ({
        totalCents: 0,
        groups: [],
        archived: [],
      }),
    })

    const wrapper = await mountSuspended(DashboardPage, {
      route: '/',
      global: { stubs: { Echarts: true } },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun compte actif')
    })
    expect(wrapper.find('[data-testid="balance-curve-chart"]').exists()).toBe(
      false,
    )
  })
})
