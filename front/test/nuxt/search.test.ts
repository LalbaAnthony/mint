import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SearchResponse } from '@mint/shared/types/search'
import AccountsPage from '~/pages/accounts/index.vue'
import EnvelopesPage from '~/pages/envelopes/index.vue'
import SearchPage from '~/pages/search/index.vue'
import GlobalSearchModal from '~/components/GlobalSearchModal.vue'
import { installFakeApi } from '../fake-api'
import {
  account,
  card,
  envelopeLine,
  envelopeMonth,
  euros,
  fillInput,
  findInBody,
  ids,
  livret,
  operation,
  overview,
  referentialHandlers,
  schedule,
  setViewportWidth,
} from '../planning-fixtures'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const initialWidth = window.innerWidth
const mounted: { unmount: () => void }[] = []

const archivedId = '00000000-0000-4000-8000-0000000000a9'
const inactiveEnvelopeId = '00000000-0000-4000-8000-0000000000f9'

function searchResponse(
  overrides: Partial<SearchResponse> = {},
): SearchResponse {
  return {
    accounts: [],
    operations: { items: [], total: 0 },
    schedules: [],
    envelopes: [],
    ...overrides,
  }
}

function searchPath(q: string, offset: number, limit: number): string {
  return `/search?${new URLSearchParams({
    q,
    operationsOffset: String(offset),
    operationsLimit: String(limit),
  }).toString()}`
}

function searchRoute(q: string, offset: number, limit: number): string {
  return `GET ${searchPath(q, offset, limit)}`
}

function setOnline(isOnline: boolean) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => isOnline,
  })
  window.dispatchEvent(new Event(isOnline ? 'online' : 'offline'))
}

function requestedPaths(): string[] {
  return fetchMock.mock.calls.map(([url]) => String(url))
}

function option(text: string): HTMLElement {
  const found = [
    ...document.body.querySelectorAll<HTMLElement>('[role="option"]'),
  ].find((element) => element.textContent?.includes(text))
  if (found === undefined) {
    throw new Error(`No option ${text}`)
  }
  return found
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  useSearchStore().closeModal()
  useAmountMaskStore().forget()
  setViewportWidth(initialWidth)
  setOnline(true)
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('search request (RCH-03)', () => {
  it('needs 2 characters once trimmed', () => {
    expect(isSearchable(' a ')).toBe(false)
    expect(isSearchable('ab')).toBe(true)
  })

  it('adds the absolute amount read in the language of the interface', () => {
    expect(searchRequestPath(' 12,50 ', 'fr', 0, 5)).toBe(
      '/search?q=12%2C50&operationsOffset=0&operationsLimit=5&amountCents=1250',
    )
    expect(searchRequestPath('-12', 'fr', 50, 50)).toBe(
      '/search?q=-12&operationsOffset=50&operationsLimit=50&amountCents=1200',
    )
    expect(searchRequestPath('12.50', 'en', 0, 5)).toContain('amountCents=1250')
  })

  it('sends the text alone when it is no amount or a too large one', () => {
    expect(searchRequestPath('Loyer', 'fr', 0, 5)).toBe(
      '/search?q=Loyer&operationsOffset=0&operationsLimit=5',
    )
    expect(searchRequestPath('9999999999999', 'fr', 0, 5)).not.toContain(
      'amountCents',
    )
  })
})

describe('search modal (RCH-01, RCH-05)', () => {
  it('opens empty with a hint, then previews 5 results per section after the first entry', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [searchRoute('co', 0, 5)]: () =>
        searchResponse({
          accounts: [account()],
          operations: {
            items: [operation(), operation({ id: ids.transferGroup })],
            total: 12,
          },
        }),
    })
    const wrapper = await mountInApp(GlobalSearchModal)
    mounted.push(wrapper)

    useSearchStore().openModal()
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="search-hint"]')?.textContent).toContain(
        'Saisissez au moins 2 caractères.',
      )
    })
    await fillInput('[data-testid="search-palette"]', 'co')

    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="search-palette"]')?.textContent,
      ).toContain('Opérations (12)')
    })
    const options = [
      ...document.body.querySelectorAll<HTMLElement>('[role="option"]'),
    ].map((element) => element.textContent ?? '')
    expect(options[0]).toContain('Voir tous les résultats pour « co »')
    expect(options).toHaveLength(4)
    expect(findInBody('[data-testid="search-palette"]')?.textContent).toContain(
      'Comptes (1)',
    )
    expect(requestedPaths()).toContain(`/api/v1${searchPath('co', 0, 5)}`)
  })

  it('masks the account balances but not the operations', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [searchRoute('co', 0, 5)]: () =>
        searchResponse({
          accounts: [account()],
          operations: { items: [operation()], total: 1 },
        }),
    })
    useAmountMaskStore().toggle()
    const wrapper = await mountInApp(GlobalSearchModal)
    mounted.push(wrapper)

    useSearchStore().openModal()
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="search-palette"] input')).not.toBeNull()
    })
    await fillInput('[data-testid="search-palette"]', 'co')

    await vi.waitFor(() => {
      expect(
        option('Compte courant').querySelector('[data-masked="true"]'),
      ).not.toBeNull()
    })
    expect(
      option('Courses').querySelector('[data-masked="false"]'),
    ).not.toBeNull()
  })

  it('opens the results page from the first entry and closes', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [searchRoute('loyer', 0, 5)]: () => searchResponse(),
    })
    const wrapper = await mountInApp(GlobalSearchModal)
    mounted.push(wrapper)

    useSearchStore().openModal()
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="search-palette"] input')).not.toBeNull()
    })
    await fillInput('[data-testid="search-palette"]', 'loyer')
    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="search-no-result"]')?.textContent,
      ).toContain('« loyer »')
    })
    expect(findInBody('[data-testid="search-no-result"]')?.classList).toContain(
      'text-center',
    )
    option('Voir tous les résultats').click()

    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.fullPath).toBe('/search?q=loyer')
    })
    expect(useSearchStore().modalOpen).toBe(false)
  })
})

describe('search results page (RCH-04 to RCH-07)', () => {
  it('shows every section with the values of the views, archived and inactive ones signalled', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [searchRoute('co', 0, 50)]: () =>
        searchResponse({
          accounts: [
            account({ currentBalanceCents: 95_500 }),
            account({
              id: archivedId,
              name: 'Ancien compte',
              archivedAt: '2026-10-01T10:00:00.000Z',
            }),
          ],
          operations: { items: [operation()], total: 1 },
          schedules: [
            schedule(),
            schedule({ id: ids.envelope, active: false }),
          ],
          envelopes: [
            {
              envelope: envelopeLine(12_000).envelope,
              status: envelopeLine(12_000).status,
            },
            {
              envelope: {
                ...envelopeLine(0).envelope,
                id: inactiveEnvelopeId,
                active: false,
              },
              status: null,
            },
          ],
        }),
    })

    const wrapper = await mountInApp(SearchPage, { route: '/search?q=co' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="search-section-envelopes"]').exists(),
      ).toBe(true)
    })
    expect(
      wrapper
        .findAll('[data-testid^="search-section-"] h2')
        .map((title) => title.text()),
    ).toEqual([
      'Comptes (2)',
      'Opérations (1)',
      'Échéances (2)',
      'Enveloppes (2)',
    ])
    expect(
      wrapper.get(`[data-testid="search-account-${ids.current}"]`).text(),
    ).toContain(euros(95_500))
    expect(
      wrapper.get(`[data-testid="search-account-${archivedId}"]`).text(),
    ).toContain('Archivé')
    const subscription = wrapper.get(
      `[data-testid="search-schedule-${ids.schedule}"]`,
    )
    expect(subscription.text()).toContain(euros(-4_416, 'exceptZero'))
    expect(subscription.text()).toContain(`${euros(368)} par mois`)
    const nextDate = new Intl.DateTimeFormat('fr', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(new Date('2027-01-25T00:00:00Z'))
    expect(subscription.text()).toContain(`prochaine le ${nextDate}`)
    expect(
      wrapper.get(`[data-testid="search-schedule-${ids.envelope}"]`).text(),
    ).toContain('Inactive')
    const envelope = wrapper.get(
      `[data-testid="search-envelope-${ids.envelope}"]`,
    )
    expect(envelope.text()).toContain(euros(18_000))
    expect(envelope.find('[data-testid="envelope-progress"]').exists()).toBe(
      true,
    )
    const inactive = wrapper.get(
      `[data-testid="search-envelope-${inactiveEnvelopeId}"]`,
    )
    expect(inactive.text()).toContain('Inactive')
    expect(inactive.text()).toContain(euros(30_000))
  })

  it('loads 50 more operations at each click on Show more', async () => {
    const first = Array.from({ length: 50 }, (_, index) =>
      operation({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      }),
    )
    const last = operation({
      id: '00000000-0000-4000-8000-100000000000',
      label: 'Dernière',
    })
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [searchRoute('co', 0, 50)]: () =>
        searchResponse({ operations: { items: first, total: 51 } }),
      [searchRoute('co', 50, 50)]: () =>
        searchResponse({ operations: { items: [last], total: 51 } }),
    })

    const wrapper = await mountInApp(SearchPage, { route: '/search?q=co' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="search-more"]').exists()).toBe(true)
    })
    expect(wrapper.findAll('[data-testid^="search-operation-"]')).toHaveLength(
      50,
    )
    await wrapper.get('[data-testid="search-more"]').trigger('click')

    await vi.waitFor(() => {
      expect(
        wrapper.findAll('[data-testid^="search-operation-"]'),
      ).toHaveLength(51)
    })
    expect(wrapper.find('[data-testid="search-more"]').exists()).toBe(false)
  })

  it('opens an account in its view and an operation in its edit modal', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [searchRoute('co', 0, 50)]: () =>
        searchResponse({
          accounts: [account()],
          operations: { items: [operation()], total: 1 },
        }),
    })
    const wrapper = await mountInApp(SearchPage, { route: '/search?q=co' })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(
        wrapper
          .find(`[data-testid="search-operation-${ids.operation}"]`)
          .exists(),
      ).toBe(true)
    })

    await wrapper
      .get(`[data-testid="search-operation-${ids.operation}"]`)
      .trigger('click')
    expect(useOperationEditorStore().request).toEqual({
      mode: 'edit',
      operation: operation(),
    })
    useOperationEditorStore().isOpen = false

    await wrapper
      .get(`[data-testid="search-account-${ids.current}"]`)
      .trigger('click')
    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.fullPath).toBe(
        `/accounts?account=${ids.current}`,
      )
    })
  })

  it('follows the typing in the URL and shows the empty state without result', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [searchRoute('zz', 0, 50)]: () => searchResponse(),
    })
    const wrapper = await mountInApp(SearchPage, { route: '/search' })
    mounted.push(wrapper)

    expect(wrapper.get('[data-testid="search-hint"]').text()).toBe(
      'Saisissez au moins 2 caractères.',
    )
    await wrapper.get('[data-testid="search-input"]').setValue('zz')

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucun résultat')
    })
    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.fullPath).toBe('/search?q=zz')
    })
  })

  it('is unavailable offline', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    setOnline(false)

    const wrapper = await mountInApp(SearchPage, { route: '/search?q=co' })
    mounted.push(wrapper)

    expect(wrapper.text()).toContain('Recherche indisponible hors ligne')
    expect(
      wrapper.get('[data-testid="search-input"]').attributes(),
    ).toHaveProperty('disabled')
    expect(requestedPaths().some((path) => path.includes('/search'))).toBe(
      false,
    )
  })
})

describe('links from the search (RCH-06)', () => {
  it('unfolds and rings the linked account until the next click elsewhere', async () => {
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => overview([account(), livret]),
      'GET /payment-methods': () => [card],
    })

    const wrapper = await mountInApp(AccountsPage, {
      route: `/accounts?account=${ids.current}`,
    })
    mounted.push(wrapper)

    const row = () => wrapper.get(`[data-testid="account-${ids.current}"]`)
    // The ring appears before the query is cleared, the unfolding after it.
    await vi.waitFor(() => {
      expect(
        row().get('[data-testid="account-toggle"]').attributes('aria-expanded'),
      ).toBe('true')
    })
    expect(row().classes()).toContain('ring-primary')
    expect(row().attributes()).toHaveProperty('data-linked-target')
    expect(useRouter().currentRoute.value.query).toEqual({})

    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()

    expect(row().classes()).not.toContain('ring-primary')
  })

  it('opens the archived accounts to ring an archived one', async () => {
    const archived = account({
      id: archivedId,
      name: 'Ancien compte',
      archivedAt: '2026-10-01T10:00:00.000Z',
    })
    installFakeApi(fetchMock, {
      'GET /accounts/overview': () => ({
        ...overview([account()]),
        archived: [archived],
      }),
      'GET /payment-methods': () => [],
    })

    const wrapper = await mountInApp(AccountsPage, {
      route: `/accounts?account=${archivedId}`,
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(
        wrapper
          .find(`[data-testid="archived-account-${archivedId}"]`)
          .classes(),
      ).toContain('ring-primary')
    })
  })

  it('rings the linked envelope of the current month, inactive ones in their open section', async () => {
    setViewportWidth(375)
    const inactive = {
      ...envelopeLine(0).envelope,
      id: inactiveEnvelopeId,
      active: false,
    }
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /envelopes': () => ({
        ...envelopeMonth([envelopeLine(12_000)]),
        inactive: [inactive],
      }),
    })

    const active = await mountInApp(EnvelopesPage, {
      route: `/envelopes?envelope=${ids.envelope}`,
    })
    mounted.push(active)
    await vi.waitFor(() => {
      expect(
        active.get(`[data-testid="envelope-${ids.envelope}"]`).classes(),
      ).toContain('ring-primary')
    })
    active.unmount()
    mounted.splice(0)

    const wrapper = await mountInApp(EnvelopesPage, {
      route: `/envelopes?envelope=${inactiveEnvelopeId}`,
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(
        wrapper
          .find(`[data-testid="inactive-envelope-${inactiveEnvelopeId}"]`)
          .classes(),
      ).toContain('ring-primary')
    })
  })
})
