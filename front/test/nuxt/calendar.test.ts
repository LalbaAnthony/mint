import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  CalendarDay,
  CalendarMonthResponse,
  CalendarOccurrence,
} from '@mint/shared/types/forecast'
import CalendarPage from '~/pages/calendar/index.vue'
import { installFakeApi } from '../fake-api'
import {
  euros,
  ids,
  operation,
  referentialHandlers,
  schedule,
  setViewportWidth,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

beforeEach(() => {
  resetCsrfToken()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-11T10:00:00Z'))
  setViewportWidth(1280)
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  vi.useRealTimers()
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

function day(overrides: Partial<CalendarDay> & { date: string }): CalendarDay {
  return {
    period: overrides.date < '2026-11-11' ? 'past' : 'future',
    balanceCents: 100_000,
    operations: [],
    occurrences: [],
    envelopeShares: [],
    ...overrides,
  }
}

function occurrence(
  overrides: Partial<CalendarOccurrence> & { amountCents: number },
): CalendarOccurrence {
  return {
    scheduleId: ids.schedule,
    kind: overrides.amountCents < 0 ? 'expense' : 'income',
    label: overrides.amountCents < 0 ? 'Dépense' : 'Salaire',
    accountId: ids.current,
    triggerMode: 'auto',
    isSubscription: false,
    occurrence: {
      originalDate: '2026-11-20',
      effectiveDate: '2026-11-20',
      amountCents: Math.abs(overrides.amountCents),
      status: 'pending',
      overridden: false,
      editable: true,
    },
    ...overrides,
  }
}

function novemberUs12(
  thresholdCents: number | null = null,
): CalendarMonthResponse {
  const days: CalendarDay[] = []
  for (let index = 1; index <= 30; index += 1) {
    const date = `2026-11-${String(index).padStart(2, '0')}`
    const balanceCents =
      date < '2026-11-20' ? 100_000 : date < '2026-11-28' ? 95_000 : 245_000
    days.push(
      day({
        date,
        period:
          date < '2026-11-11'
            ? 'past'
            : date === '2026-11-11'
              ? 'today'
              : 'future',
        balanceCents,
        occurrences:
          date === '2026-11-20'
            ? [occurrence({ amountCents: -5_000 })]
            : date === '2026-11-28'
              ? [
                  occurrence({
                    amountCents: 150_000,
                    triggerMode: 'manual',
                    scheduleId: '00000000-0000-4000-8000-0000000000f3',
                  }),
                ]
              : [],
      }),
    )
  }
  return {
    today: '2026-11-11',
    accountId: thresholdCents === null ? null : ids.current,
    thresholdCents,
    horizonMonths: 3,
    endDate: '2027-02-11',
    month: '2026-11-01',
    firstMonth: '2026-11-01',
    lastMonth: '2027-02-01',
    days,
  }
}

describe('calendar utilities (CAL-01, CHG-62, CHG-63)', () => {
  it('starts the weeks on Monday and pads the month with days of the neighbour months', () => {
    const cells = calendarCells('2026-11-01', novemberUs12().days)

    expect(cells).toHaveLength(42)
    expect(cells[0]).toMatchObject({
      date: '2026-10-26',
      inMonth: false,
      day: null,
    })
    expect(cells[6]).toMatchObject({
      date: '2026-11-01',
      inMonth: true,
      nonWorking: true,
    })
    expect(cells.at(-1)?.date).toBe('2026-12-06')
    expect(cells.find((cell) => cell.date === '2026-11-11')?.nonWorking).toBe(
      true,
    )
    expect(cells.find((cell) => cell.date === '2026-11-12')?.nonWorking).toBe(
      false,
    )
  })

  it('tints a day below the threshold or negative, the negative first (CA-07)', () => {
    expect(calendarAlert(15_000, 20_000)).toBe('belowThreshold')
    expect(calendarAlert(-1_000, 20_000)).toBe('negative')
    expect(calendarAlert(-1, null)).toBe('negative')
    expect(calendarAlert(20_000, 20_000)).toBe('none')
    expect(calendarAlert(null, 20_000)).toBe('none')
  })

  it('gives up to three dots: credit, debit and manual payment', () => {
    expect(
      calendarDots(
        day({
          date: '2026-11-20',
          occurrences: [
            occurrence({ amountCents: -5_000, triggerMode: 'manual' }),
            occurrence({ amountCents: 1_000 }),
          ],
        }),
      ),
    ).toEqual(['credit', 'debit', 'manual'])
    expect(
      calendarDots(
        day({
          date: '2026-11-05',
          operations: [operation({ amountCents: -100 })],
        }),
      ),
    ).toEqual(['debit'])
  })
})

describe('calendar view (CAL-01 to CAL-06)', () => {
  it('shows the signed occurrences and the forecast balance of each day (US-12, CA-05)', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /calendar/2026-11-01?horizonMonths=3': () => novemberUs12(),
    })

    const wrapper = await mountSuspended(CalendarPage, { route: '/calendar' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="calendar-grid"]').exists()).toBe(true)
    })
    expect(wrapper.get('[data-testid="calendar-month"]').text()).toBe(
      'novembre 2026',
    )
    const nineteenth = wrapper.get('[data-testid="calendar-day-2026-11-19"]')
    expect(nineteenth.get('[data-testid="calendar-balance"]').text()).toBe(
      euros(100_000),
    )
    const twentieth = wrapper.get('[data-testid="calendar-day-2026-11-20"]')
    const debit = twentieth.get(
      `[data-testid="calendar-occurrence-${ids.schedule}-2026-11-20"] [data-testid="money-amount"]`,
    )
    expect(debit.text()).toBe(euros(-5_000, 'exceptZero'))
    expect(debit.classes()).toContain('text-default')
    expect(debit.classes()).toContain('tabular-nums')
    expect(twentieth.get('[data-testid="calendar-balance"]').text()).toBe(
      euros(95_000),
    )
    const twentyEighth = wrapper.get('[data-testid="calendar-day-2026-11-28"]')
    const credit = twentyEighth.get(
      '[data-testid^="calendar-occurrence-"] [data-testid="money-amount"]',
    )
    expect(credit.text()).toBe(euros(150_000, 'exceptZero'))
    expect(credit.classes()).toContain('text-success')
    expect(twentyEighth.text()).toContain(euros(245_000))
    expect(twentyEighth.find('[aria-label="Paiement manuel"]').exists()).toBe(
      true,
    )
    expect(api.requests.map((request) => request.path)).toContain(
      '/calendar/2026-11-01?horizonMonths=3',
    )
  })

  it('tints the days below the threshold or negative of the selected account (CA-07)', async () => {
    const response = novemberUs12(20_000)
    response.days = response.days.map((entry) =>
      entry.date === '2026-11-20'
        ? { ...entry, balanceCents: 15_000 }
        : entry.date === '2026-11-21'
          ? { ...entry, balanceCents: -1_000 }
          : entry,
    )
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /calendar/2026-11-01?accountId=${ids.current}&horizonMonths=3`]:
        () => response,
    })
    const view = useForecastViewStore()
    view.calendarAccountId = ids.current

    const wrapper = await mountSuspended(CalendarPage, { route: '/calendar' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="calendar-grid"]').exists()).toBe(true)
    })
    const below = wrapper.get('[data-testid="calendar-day-2026-11-20"]')
    expect(below.attributes('data-alert')).toBe('belowThreshold')
    expect(below.classes()).toContain('bg-warning/10')
    const belowBalance = below.get('[data-testid="calendar-balance"]')
    expect(belowBalance.classes()).toContain('text-warning')
    expect(belowBalance.attributes('data-state')).toBe('belowThreshold')
    const negative = wrapper.get('[data-testid="calendar-day-2026-11-21"]')
    expect(negative.classes()).toContain('bg-error/10')
    expect(
      negative.get('[data-testid="calendar-balance"]').classes(),
    ).toContain('text-error')
    view.calendarAccountId = null
  })

  it('shows the real operations of a past day in its detail', async () => {
    const response = novemberUs12()
    response.days = response.days.map((entry) =>
      entry.date === '2026-11-05'
        ? {
            ...entry,
            operations: [
              operation({ amountCents: -4_500 }),
              operation({
                id: '00000000-0000-4000-8000-0000000000d2',
                amountCents: -500,
                label: 'Boulangerie',
                categoryId: null,
                status: 'to_categorize',
              }),
            ],
            balanceCents: 95_000,
          }
        : entry,
    )
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /calendar/2026-11-01?horizonMonths=3': () => response,
    })

    const wrapper = await mountSuspended(CalendarPage, { route: '/calendar' })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="calendar-grid"]').exists()).toBe(true)
    })

    const fifth = wrapper.get('[data-testid="calendar-day-2026-11-05"]')
    expect(
      fifth.get('[data-testid="calendar-operations-summary"]').text(),
    ).toContain('2 opérations')
    expect(
      fifth.get('[data-testid="calendar-operations-summary"]').text(),
    ).toContain(euros(-5_000, 'exceptZero'))

    await wrapper
      .get('[data-testid="calendar-select-2026-11-05"]')
      .trigger('click')

    const detail = wrapper.get('[data-testid="calendar-day-detail"]')
    expect(detail.text()).toContain('Boulangerie')
    expect(detail.get('[data-testid="calendar-detail-total"]').text()).toBe(
      euros(-5_000, 'exceptZero'),
    )
    expect(detail.get('[data-testid="calendar-detail-balance"]').text()).toBe(
      euros(95_000),
    )
  })

  it('switches to compact dots under 768 px with the detail under the grid (CAL-06)', async () => {
    setViewportWidth(375)
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /calendar/2026-11-01?horizonMonths=3': () => novemberUs12(),
    })

    const wrapper = await mountSuspended(CalendarPage, { route: '/calendar' })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="calendar-grid"]').exists()).toBe(true)
    })

    const twentyEighth = wrapper.get('[data-testid="calendar-day-2026-11-28"]')
    expect(
      twentyEighth
        .findAll('[data-dot]')
        .map((dot) => dot.attributes('data-dot')),
    ).toEqual(['credit', 'manual'])
    expect(twentyEighth.find('[data-testid="calendar-balance"]').exists()).toBe(
      false,
    )
    expect(wrapper.find('[data-testid="calendar-day-detail"]').exists()).toBe(
      true,
    )
  })

  it('opens the schedule of an occurrence from its menu (CAL-05)', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /calendar/2026-11-01?horizonMonths=3': () => novemberUs12(),
      'GET /schedules': () => ({
        schedules: [schedule()],
        totals: { expensesCents: 0, incomesCents: 0, savingsTransfersCents: 0 },
      }),
      [`GET /schedules/${ids.schedule}/occurrences`]: () => ({
        from: '2026-11-11',
        to: '2027-02-11',
        occurrences: [],
      }),
    })

    const wrapper = await mountSuspended(CalendarPage, { route: '/calendar' })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="calendar-grid"]').exists()).toBe(true)
    })

    await wrapper
      .get(`[data-testid="calendar-occurrence-${ids.schedule}-2026-11-20"]`)
      .trigger('click')
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain("Ouvrir l'échéance")
    })
    const openItem = [
      ...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ].find((item) => item.textContent?.includes("Ouvrir l'échéance"))
    openItem?.click()

    await vi.waitFor(() => {
      expect(api.requests.map((request) => request.path)).toContain(
        '/schedules',
      )
    })
  })
})
