import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScheduleDetailModal from '~/components/ScheduleDetailModal.vue'
import ScheduleFormModal from '~/components/ScheduleFormModal.vue'
import SchedulesPage from '~/pages/schedules/index.vue'
import { installFakeApi } from '../fake-api'
import {
  euros,
  fillInput,
  findInBody,
  ids,
  livret,
  overview,
  referentialHandlers,
  schedule,
  selectByTestId,
  setViewportWidth,
  submit,
} from '../planning-fixtures'
import { setDefaultAccount } from '../session'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const initialWidth = window.innerWidth
const mounted: { unmount: () => void }[] = []

const totals = {
  expensesCents: 368,
  incomesCents: 0,
  savingsTransfersCents: 0,
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  setViewportWidth(initialWidth)
  fetchMock.mockReset()
  useAmountMaskStore().forget()
  document.body.innerHTML = ''
})

describe('schedules view (ECH-09, ECH-10)', () => {
  it('shows the annual subscription of US-06 at 3.68 EUR per month with its next occurrence on 25 January 2027', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /schedules': () => ({ schedules: [schedule()], totals }),
    })

    const wrapper = await mountInApp(SchedulesPage, { route: '/schedules' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Musique')
    })
    const list = wrapper.get('[data-testid="schedules-list"]').text()
    expect(list).toContain(euros(368))
    expect(list).toContain(euros(-4_416, 'exceptZero'))
    expect(list).toContain(
      new Intl.DateTimeFormat('fr', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(new Date('2027-01-25T00:00:00Z')),
    )
    expect(list).toContain('Tous les ans')
    expect(list).toContain('Carte CA')
    expect(wrapper.find('[aria-label="Abonnement"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="total-expenses"]').text()).toBe(
      euros(368),
    )
  })

  it('masks the totals but keeps the schedules in clear in masked mode (DSH-05)', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /schedules': () => ({
        schedules: [schedule()],
        totals: {
          expensesCents: 368,
          incomesCents: 250_000,
          savingsTransfersCents: 30_000,
        },
      }),
    })
    useAmountMaskStore().toggle()

    const wrapper = await mountInApp(SchedulesPage, { route: '/schedules' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Musique')
    })
    for (const testId of ['total-expenses', 'total-incomes', 'total-savings']) {
      expect(
        wrapper.get(`[data-testid="${testId}"]`).attributes('data-masked'),
      ).toBe('true')
    }
    const totalCards = wrapper.get('[data-testid="schedule-totals"]').text()
    expect(totalCards).toContain('****')
    expect(totalCards).not.toContain(euros(368))
    expect(totalCards).not.toContain(euros(250_000))
    expect(totalCards).not.toContain(euros(30_000))
    const list = wrapper.get('[data-testid="schedules-list"]').text()
    expect(list).toContain(euros(368))
    expect(list).toContain(euros(-4_416, 'exceptZero'))
  })

  it('folds inactive and ended schedules apart', async () => {
    setViewportWidth(390)
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /schedules': () => ({
        schedules: [
          schedule({ label: 'Active' }),
          schedule({
            id: '00000000-0000-4000-8000-0000000000f3',
            label: 'Ancienne',
            active: false,
          }),
        ],
        totals,
      }),
    })

    const wrapper = await mountInApp(SchedulesPage, { route: '/schedules' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Inactives ou terminées (1)')
    })
    expect(wrapper.get('[data-testid="schedules-list"]').text()).not.toContain(
      'Ancienne',
    )
  })
})

describe('schedule form (ECH-01 to ECH-06)', () => {
  async function openCreation(handlers = referentialHandlers()) {
    const api = installFakeApi(fetchMock, {
      ...handlers,
      'POST /schedules': () => schedule({ kind: 'transfer' }),
    })
    await useReferentialsStore().load()
    const wrapper = await mountInApp(ScheduleFormModal, {
      props: { open: true, schedule: null },
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="schedule-form"]')).not.toBeNull()
    })
    return { api, wrapper }
  }

  it('prefills the payment source with the default account (ADR 0033)', async () => {
    setDefaultAccount(ids.livret)

    const { wrapper } = await openCreation()

    expect(selectByTestId(wrapper, 'schedule-source')?.value()).toBe(
      `account:${ids.livret}`,
    )
  })

  it('leaves the payment source empty without default account among several accounts (ADR 0033)', async () => {
    const { wrapper } = await openCreation()

    expect(selectByTestId(wrapper, 'schedule-source')?.value()).toBeUndefined()
  })

  it('preselects the only active account without default account (ADR 0033)', async () => {
    const { wrapper } = await openCreation({
      ...referentialHandlers(),
      'GET /accounts/overview': () => overview([livret]),
    })

    expect(selectByTestId(wrapper, 'schedule-source')?.value()).toBe(
      `account:${ids.livret}`,
    )
  })

  it('creates a monthly transfer from the default account to the chosen target (ADR 0033)', async () => {
    setDefaultAccount(ids.current)
    const { api, wrapper } = await openCreation()

    findInBody('[data-testid="schedule-kind"] [value="transfer"]')?.click()
    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="schedule-source-account"]'),
      ).not.toBeNull()
    })
    expect(selectByTestId(wrapper, 'schedule-source-account')?.value()).toBe(
      ids.current,
    )
    const target = selectByTestId(wrapper, 'schedule-target-account')
    expect(target?.value()).toBeUndefined()
    target?.choose(ids.livret)
    await fillInput('[data-testid="schedule-label"]', 'Epargne')
    await fillInput('[data-testid="schedule-amount"]', '100')
    await fillInput('[data-testid="schedule-start-date"]', '2026-12-06')
    submit('[data-testid="schedule-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({
        kind: 'transfer',
        label: 'Epargne',
        amountCents: 10_000,
        triggerMode: 'auto',
        reminderDaysBefore: 2,
        note: null,
        active: true,
        frequency: 'monthly',
        interval: 1,
        startDate: '2026-12-06',
        anchorLastDay: false,
        endDate: null,
        maxOccurrences: null,
        businessDayRule: 'exact',
        amountTolerancePct: 10,
        bankLabelPatterns: [],
        tagIds: [],
        sourceAccountId: ids.current,
        targetAccountId: ids.livret,
      })
    })
  })
})

describe('schedule detail (ECH-07)', () => {
  it('lists the upcoming occurrences and skips one', async () => {
    const occurrence = {
      originalDate: '2027-01-25',
      effectiveDate: '2027-01-25',
      amountCents: 4_416,
      status: 'pending',
      overridden: false,
      editable: true,
    }
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /schedules/${ids.schedule}/occurrences`]: () => ({
        from: '2026-11-11',
        to: '2027-02-11',
        occurrences: [occurrence],
      }),
      [`POST /schedules/${ids.schedule}/occurrences/2027-01-25/skip`]: () => ({
        ...occurrence,
        status: 'skipped',
      }),
    })
    await useReferentialsStore().load()
    const wrapper = await mountInApp(ScheduleDetailModal, {
      props: { open: true, schedule: schedule() },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="occurrence-2027-01-25"]')).not.toBeNull()
    })
    expect(
      findInBody('[data-testid="schedule-detail"]')?.textContent,
    ).toContain(euros(368))
    findInBody('[data-testid="occurrence-skip"]')?.click()

    await vi.waitFor(() => {
      expect(
        api.requests.some(
          (request) =>
            request.method === 'POST' &&
            request.path ===
              `/schedules/${ids.schedule}/occurrences/2027-01-25/skip`,
        ),
      ).toBe(true)
    })
    expect(
      wrapper.getComponent(ScheduleDetailModal).emitted('changed'),
    ).toHaveLength(1)
  })
})
