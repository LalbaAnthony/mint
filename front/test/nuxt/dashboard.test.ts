import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  BreakdownResponse,
  MonthlyReportResponse,
} from '@mint/shared/types/dashboard'
import type {
  BalanceCurvePoint,
  BalanceCurveResponse,
} from '@mint/shared/types/forecast'
import { balanceCurveOption, balanceCurveSeries } from '~/charts/balance-curve'
import {
  categorySlices,
  donutOption,
  groupRows,
  groupSlices,
} from '~/charts/breakdown'
import { monthlyOption } from '~/charts/monthly'
import { toSrgbHex } from '~/charts/theme'
import DashboardPage from '~/pages/index.vue'
import type { ChartTheme } from '~~/types/forecast'
import { apiFailure, installFakeApi } from '../fake-api'
import { euros, ids, percents, referentialHandlers } from '../planning-fixtures'
import { setDefaultAccount } from '../session'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  resetCsrfToken()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'))
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  vi.useRealTimers()
  fetchMock.mockReset()
  useAmountMaskStore().forget()
  document.body.innerHTML = ''
})

const theme: ChartTheme = {
  needs: '#2563eb',
  wants: '#de5333',
  save: '#3d853c',
  needsShades: ['#2563eb', '#60a5fa'],
  wantsShades: ['#de5333', '#f58468'],
  balance: '#3d853c',
  threshold: '#d97706',
  negative: '#dc2626',
  income: '#059669',
  expense: '#7c7c6e',
  net: '#3a3a30',
  textMuted: '#6b6b5f',
  investment: '#7c3aed',
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

function optionOf(
  response: BalanceCurveResponse,
  ariaDescription: string | null = null,
) {
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
    ariaDescription,
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

  it('replaces the generated description when the amounts are masked (DSH-05, CHG-45)', () => {
    expect(optionOf(curve(), 'Montants masqués.').aria).toEqual({
      enabled: true,
      label: { description: 'Montants masqués.' },
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
        ariaDescription: null,
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
      ...dashboardHandlers(),
    })

    const wrapper = await mountInApp(DashboardPage, {
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

  it('opens the forecast curve on the default account of the profile (ADR 0033)', async () => {
    setDefaultAccount(ids.current)
    const path = `/forecast/curve?accountId=${ids.current}&horizonMonths=3`
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET ${path}`]: () => curve(),
      ...dashboardHandlers(),
    })

    const wrapper = await mountInApp(DashboardPage, {
      route: '/',
      global: { stubs: { Echarts: true } },
    })
    mounted.push(wrapper)

    await vi.waitFor(
      () => {
        expect(api.requests.map((request) => request.path)).toContain(path)
      },
      { timeout: 10_000 },
    )
    expect(api.requests.map((request) => request.path)).not.toContain(
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

    const wrapper = await mountInApp(DashboardPage, {
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

function breakdownFixture(): BreakdownResponse {
  return {
    from: '2026-11-01',
    to: '2026-11-30',
    needs: {
      totalCents: 60_000,
      categories: [{ categoryId: ids.groceries, totalCents: 60_000 }],
    },
    wants: {
      totalCents: 30_000,
      categories: [{ categoryId: ids.leisure, totalCents: 30_000 }],
    },
    saveCents: 10_000,
    toCategorizeCents: 500,
    targets: { needs: 50, wants: 30, save: 20 },
  }
}

function monthlyFixture(): MonthlyReportResponse {
  return {
    today: '2026-11-11',
    currentMonth: '2026-11-01',
    months: [
      {
        month: '2026-10-01',
        real: { incomeCents: 200_000, expenseCents: 150_000 },
        planned: { incomeCents: 0, expenseCents: 0 },
        balanceCents: 50_000,
      },
      {
        month: '2026-11-01',
        real: { incomeCents: 0, expenseCents: 4_500 },
        planned: { incomeCents: 150_000, expenseCents: 60_000 },
        balanceCents: 85_500,
      },
    ],
  }
}

function dashboardHandlers() {
  return {
    'GET /dashboard/summary': () => ({
      wealthCents: 1_900_000,
      alerts: [
        {
          accountId: ids.current,
          firstBelowThresholdDate: '2026-11-16',
          minBalanceCents: 15_000,
          thresholdCents: 20_000,
        },
      ],
      capAlerts: [
        { accountId: ids.livret, date: '2026-12-06', excessCents: 5_000 },
      ],
      toCategorizeCount: 3,
      pendingProposalsCount: 2,
      pendingImportIds: ['00000000-0000-4000-8000-0000000000aa'],
    }),
    'GET /dashboard/breakdown?from=2026-11-01&to=2026-11-30': () =>
      breakdownFixture(),
    'GET /dashboard/monthly?horizonMonths=3': () => monthlyFixture(),
  }
}

describe('breakdown chart (DSH-02, CHG-74, CHG-22)', () => {
  const names = { needs: 'Besoins', wants: 'Envies', save: 'Épargne' }

  it('compares each group with its target and flags the unfavourable gaps', () => {
    expect(groupRows(breakdownFixture(), names)).toEqual([
      {
        group: 'needs',
        name: 'Besoins',
        actualCents: 60_000,
        actualPct: 60,
        targetPct: 50,
        gapPct: 10,
        unfavourable: true,
      },
      {
        group: 'wants',
        name: 'Envies',
        actualCents: 30_000,
        actualPct: 30,
        targetPct: 30,
        gapPct: 0,
        unfavourable: false,
      },
      {
        group: 'save',
        name: 'Épargne',
        actualCents: 10_000,
        actualPct: 10,
        targetPct: 20,
        gapPct: -10,
        unfavourable: true,
      },
    ])
  })

  it('colours the categories with the shades of their group and hatches beyond the palette', () => {
    const many: BreakdownResponse = {
      ...breakdownFixture(),
      needs: {
        totalCents: 3,
        categories: [
          { categoryId: 'a', totalCents: 1 },
          { categoryId: 'b', totalCents: 1 },
          { categoryId: 'c', totalCents: 1 },
        ],
      },
    }

    const slices = categorySlices(
      many,
      'needs',
      (id) => id,
      () => 0,
      theme,
    )

    expect(slices.map((slice) => [slice.color, slice.hatched])).toEqual([
      ['#2563eb', false],
      ['#60a5fa', false],
      ['#2563eb', true],
    ])
    const option = donutOption({
      slices: groupSlices(breakdownFixture(), names, theme),
      totalLabel: 'Total',
      theme,
      money: (cents) => `${cents / 100} €`,
      percent: (value) => percents(value),
      animate: false,
      ariaDescription: null,
    })
    expect(JSON.stringify(option.graphic)).toContain('Total\\n1000 €')
  })

  it('labels the donut slices with one-decimal percentages of the locale (CHG-20)', () => {
    const option = donutOption({
      slices: groupSlices(breakdownFixture(), names, theme),
      totalLabel: 'Total',
      theme,
      money: String,
      percent: (value) => percents(value, 'auto', 'en'),
      animate: false,
      ariaDescription: null,
    })
    const [pie] = Array.isArray(option.series) ? option.series : []
    const formatter = pie?.label?.formatter

    expect(pie?.percentPrecision).toBe(1)
    expect(
      typeof formatter === 'function'
        ? formatter({
            componentType: 'series',
            componentSubType: 'pie',
            componentIndex: 0,
            name: 'Needs',
            dataIndex: 0,
            data: 60_000,
            value: 60_000,
            percent: 33.3,
            $vars: [],
          })
        : null,
    ).toBe(`Needs ${percents(33.3, 'auto', 'en')}`)
  })
})

describe('monthly chart (DSH-03, CHG-75)', () => {
  it('stacks the planned part over the real part with a hatch and marks the current month', () => {
    const option = monthlyOption({
      report: monthlyFixture(),
      theme,
      labels: {
        realIncome: 'Revenus réels',
        plannedIncome: 'Revenus prévus',
        realExpense: 'Dépenses réelles',
        plannedExpense: 'Dépenses prévues',
        net: 'Solde',
        today: "Aujourd'hui",
      },
      money: String,
      monthLabel: String,
      animate: false,
      ariaDescription: null,
    })
    const series = Array.isArray(option.series) ? option.series : []

    expect(series.map((item) => [item.name, item.stack])).toEqual([
      ['Revenus réels', 'income'],
      ['Revenus prévus', 'income'],
      ['Dépenses réelles', 'expense'],
      ['Dépenses prévues', 'expense'],
      ['Solde', undefined],
    ])
    expect(series[1]?.data).toEqual(['-', 150_000])
    expect(JSON.stringify(series[1])).toContain('"rotation"')
    expect(JSON.stringify(series[0])).toContain('"xAxis":"2026-11-01"')
  })
})

describe('dashboard banner (DSH-04, CHG-65)', () => {
  it('shows the wealth, the alert and the coral counters', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /forecast/curve?horizonMonths=3': () => curve(),
      ...dashboardHandlers(),
    })

    const wrapper = await mountInApp(DashboardPage, {
      route: '/',
      global: { stubs: { Echarts: true } },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="dashboard-banner"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.get('[data-testid="dashboard-wealth"]').text()).toBe(
      euros(1_900_000),
    )
    expect(wrapper.get('[data-testid="dashboard-alerts"]').text()).toContain(
      'Compte courant',
    )
    expect(wrapper.get('[data-testid="dashboard-cap-alert"]').text()).toContain(
      `dépasse le plafond de ${euros(5_000)}`,
    )
    expect(
      wrapper.get('[data-testid="dashboard-to-categorize"]').text(),
    ).toContain('3')
    expect(
      wrapper.get('[data-testid="dashboard-proposals"]').attributes('href'),
    ).toBe('/import?batch=00000000-0000-4000-8000-0000000000aa')
    await vi.waitFor(
      () => {
        expect(
          wrapper.find('[data-testid="breakdown-row-save"]').exists(),
        ).toBe(true)
      },
      { timeout: 10_000 },
    )
    expect(
      wrapper
        .get('[data-testid="breakdown-row-save"] [data-unfavourable]')
        .attributes('data-unfavourable'),
    ).toBe('true')
  })
})

describe('masked dashboard (DSH-05, CHG-45)', () => {
  it('masks the amounts and the chart values but keeps the states and the percentages', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /forecast/curve?horizonMonths=3': () => curve(),
      ...dashboardHandlers(),
    })
    useAmountMaskStore().toggle()

    const wrapper = await mountInApp(DashboardPage, {
      route: '/',
      global: { stubs: { Echarts: true } },
    })
    mounted.push(wrapper)

    await vi.waitFor(
      () => {
        expect(
          wrapper.find('[data-testid="breakdown-row-save"]').exists(),
        ).toBe(true)
      },
      { timeout: 10_000 },
    )
    const wealth = wrapper.get('[data-testid="dashboard-wealth"]')
    expect(wealth.attributes('data-masked')).toBe('true')
    expect(wealth.text()).toContain('****')
    expect(wealth.text()).not.toContain(euros(1_900_000))
    const alerts = wrapper.get('[data-testid="dashboard-alerts"]')
    expect(alerts.text()).toContain('Compte courant')
    expect(alerts.text()).not.toContain(euros(15_000))
    expect(
      alerts.get('[data-testid="money-amount"]').attributes('data-state'),
    ).toBe('belowThreshold')
    expect(wrapper.get('[data-testid="dashboard-cap-alert"]').text()).toContain(
      'dépasse le plafond de ****',
    )
    const minimum = wrapper.get('[data-testid="dashboard-minimum"]')
    expect(minimum.text()).not.toContain(euros(-5_000))
    expect(
      minimum.get('[data-testid="money-amount"]').attributes('data-state'),
    ).toBe('negative')
    const save = wrapper.get('[data-testid="breakdown-row-save"]')
    expect(save.text()).not.toContain(euros(10_000))
    expect(save.text()).toContain(percents(10))
    expect(save.text()).toContain(percents(20))
    expect(save.text()).toContain(percents(-10, 'exceptZero'))
    const charts = wrapper.findAllComponents({ name: 'Echarts' })
    expect(charts.length).toBeGreaterThan(0)
    for (const chart of charts) {
      expect(chart.props('option')).toMatchObject({
        aria: {
          label: { description: 'Graphique dont les montants sont masqués.' },
        },
      })
    }
  })
})

function pending<T>() {
  let resolve: (value: T) => void = () => undefined
  const promise = new Promise<T>((onResolve) => {
    resolve = onResolve
  })
  return { promise, resolve }
}

describe('dashboard loading skeletons (CHG-47 to CHG-49, ADR 0036)', () => {
  async function mountDashboard() {
    const wrapper = await mountInApp(DashboardPage, {
      route: '/',
      global: { stubs: { Echarts: true } },
    })
    mounted.push(wrapper)
    return wrapper
  }

  it('shows each section skeleton until its own answer arrives', async () => {
    const summary = pending<unknown>()
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /forecast/curve?horizonMonths=3': () => curve(),
      ...dashboardHandlers(),
      'GET /dashboard/summary': () => summary.promise,
    })

    const wrapper = await mountDashboard()

    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="dashboard-banner-skeleton"]').exists(),
      ).toBe(true)
      expect(wrapper.find('[data-testid="balance-curve-chart"]').exists()).toBe(
        true,
      )
    })
    const zone = wrapper
      .get('[data-testid="dashboard-banner-skeleton"]')
      .element.closest('[role="status"]')
    expect(zone?.getAttribute('aria-busy')).toBe('true')
    expect(zone?.textContent).toContain('Chargement...')
    expect(
      wrapper.get('[data-testid="dashboard-banner-skeleton"]').text(),
    ).toContain('Patrimoine total')

    summary.resolve(dashboardHandlers()['GET /dashboard/summary']())
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="dashboard-wealth"]').exists()).toBe(
        true,
      )
    })
    expect(
      wrapper.find('[data-testid="dashboard-banner-skeleton"]').exists(),
    ).toBe(false)
  })

  it('shows the scope and curve skeletons on the first load of the accounts', async () => {
    useReferentialsStore().accounts = []
    const overview = pending<unknown>()
    const handlers = referentialHandlers()
    const overviewHandler = handlers['GET /accounts/overview']
    installFakeApi(fetchMock, {
      ...handlers,
      'GET /accounts/overview': () => overview.promise,
      'GET /forecast/curve?horizonMonths=3': () => curve(),
      ...dashboardHandlers(),
    })

    const wrapper = await mountDashboard()

    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="forecast-scope-skeleton"]').exists(),
      ).toBe(true)
      expect(
        wrapper.find('[data-testid="balance-curve-skeleton"]').exists(),
      ).toBe(true)
    })

    overview.resolve(
      overviewHandler?.({
        method: 'GET',
        path: '',
        body: undefined,
        headers: {},
      }),
    )
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="balance-curve-chart"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.find('[data-testid="forecast-account"]').exists()).toBe(true)
    expect(
      wrapper.find('[data-testid="forecast-scope-skeleton"]').exists(),
    ).toBe(false)
  })

  it('replaces a failed section with a retry state', async () => {
    let attempts = 0
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /forecast/curve?horizonMonths=3': () => curve(),
      ...dashboardHandlers(),
      'GET /dashboard/summary': () => {
        attempts += 1
        return attempts === 1
          ? apiFailure(500, { error: 'internal' })
          : dashboardHandlers()['GET /dashboard/summary']()
      },
    })

    const wrapper = await mountDashboard()

    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="dashboard-banner-error"]').exists(),
      ).toBe(true)
    })
    expect(
      wrapper.get('[data-testid="dashboard-banner-error"]').text(),
    ).toContain('Chargement impossible')
    expect(wrapper.find('[data-testid="balance-curve-chart"]').exists()).toBe(
      true,
    )

    await wrapper.get('[data-testid="load-error-retry"]').trigger('click')
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="dashboard-wealth"]').exists()).toBe(
        true,
      )
    })
    expect(attempts).toBe(2)
  })

  it('keeps the sections in place during a background refresh', async () => {
    const refreshed = pending<unknown>()
    let curveCalls = 0
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /forecast/curve?horizonMonths=3': () => {
        curveCalls += 1
        return curveCalls === 1 ? curve() : refreshed.promise
      },
      ...dashboardHandlers(),
    })
    const wrapper = await mountDashboard()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="balance-curve-chart"]').exists()).toBe(
        true,
      )
    })

    useOperationEditorStore().savedVersion += 1
    await vi.waitFor(() => {
      expect(curveCalls).toBe(2)
    })
    await new Promise((resolve) => setTimeout(resolve, 200))

    expect(wrapper.find('[data-testid="balance-curve-chart"]').exists()).toBe(
      true,
    )
    expect(wrapper.find('[data-testid="skeleton-zone"]').exists()).toBe(false)
    refreshed.resolve(curve())
  })

  it('shows the skeleton of the sections whose context changes', async () => {
    const curveSix = pending<unknown>()
    const monthlySix = pending<unknown>()
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /forecast/curve?horizonMonths=3': () => curve(),
      'GET /forecast/curve?horizonMonths=6': () => curveSix.promise,
      ...dashboardHandlers(),
      'GET /dashboard/monthly?horizonMonths=6': () => monthlySix.promise,
    })
    const wrapper = await mountDashboard()
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="monthly-chart"]').exists()).toBe(true)
    })

    useForecastViewStore().horizonMonths = 6
    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="balance-curve-skeleton"]').exists(),
      ).toBe(true)
      expect(wrapper.find('[data-testid="monthly-skeleton"]').exists()).toBe(
        true,
      )
    })
    expect(wrapper.find('[data-testid="forecast-account"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="breakdown-chart"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="dashboard-wealth"]').exists()).toBe(true)

    curveSix.resolve(curve())
    monthlySix.resolve(monthlyFixture())
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="monthly-chart"]').exists()).toBe(true)
    })
    useForecastViewStore().horizonMonths = 3
  })
})
