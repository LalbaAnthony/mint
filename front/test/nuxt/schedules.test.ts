import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
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
  referentialHandlers,
  schedule,
  setViewportWidth,
  submit,
} from '../planning-fixtures'

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

    const wrapper = await mountSuspended(SchedulesPage, { route: '/schedules' })
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

    const wrapper = await mountSuspended(SchedulesPage, { route: '/schedules' })
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

    const wrapper = await mountSuspended(SchedulesPage, { route: '/schedules' })
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
  it('creates a monthly transfer between the first two accounts', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /schedules': () => schedule({ kind: 'transfer' }),
    })
    await useReferentialsStore().load()
    const wrapper = await mountSuspended(ScheduleFormModal, {
      props: { open: true, schedule: null },
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="schedule-form"]')).not.toBeNull()
    })

    findInBody('[data-testid="schedule-kind"] [value="transfer"]')?.click()
    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="schedule-source-account"]'),
      ).not.toBeNull()
    })
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
    const wrapper = await mountSuspended(ScheduleDetailModal, {
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
    expect(wrapper.emitted('changed')).toHaveLength(1)
  })
})
