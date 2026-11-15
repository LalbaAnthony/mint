import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OperationFormModal from '~/components/OperationFormModal.vue'
import OperationRow from '~/components/OperationRow.vue'
import ReconciliationProposalModal from '~/components/ReconciliationProposalModal.vue'
import OperationsPage from '~/pages/operations/index.vue'
import { installFakeApi } from '../fake-api'
import {
  euros,
  fillInput,
  findInBody,
  ids,
  operation,
  referentialHandlers,
  setViewportWidth,
  submit,
  typeInto,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const listPath = '/operations?page=1&pageSize=50&sort=date&order=desc'
const initialWidth = window.innerWidth
const mounted: { unmount: () => void }[] = []

async function mountPage() {
  const wrapper = await mountSuspended(OperationsPage, { route: '/operations' })
  mounted.push(wrapper)
  return wrapper
}

async function mountForm() {
  const wrapper = await mountSuspended(OperationFormModal)
  mounted.push(wrapper)
  return wrapper
}

function page(items = [operation()]) {
  return { items, total: items.length, page: 1, pageSize: 50 }
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  useOperationEditorStore().isOpen = false
  setViewportWidth(initialWidth)
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('operations list (OPE-03 to OPE-05)', () => {
  it('shows each operation with its signed amount, category, origin and to-categorize badge', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET ${listPath}`]: () =>
        page([
          operation({ origin: 'schedule' }),
          operation({
            id: '00000000-0000-4000-8000-0000000000d2',
            label: 'Remboursement',
            amountCents: 2_000,
            categoryId: null,
            status: 'to_categorize',
          }),
        ]),
    })

    const wrapper = await mountPage()

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Remboursement')
    })
    const text = wrapper.get('[data-testid="operations-list"]').text()
    expect(text).toContain(euros(-4_500, 'exceptZero'))
    expect(text).toContain(euros(2_000, 'exceptZero'))
    expect(text).toContain('Courses')
    expect(text).toContain('À catégoriser')
    expect(
      wrapper.find('[aria-label="Générée depuis une échéance"]').exists(),
    ).toBe(true)
  })

  it('searches the labels and notes', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET ${listPath}`]: () => page(),
      [`GET ${listPath}&q=loyer`]: () => page([]),
    })
    const wrapper = await mountPage()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Courses')
    })

    typeInto(wrapper.element, '[data-testid="operations-search"]', 'loyer')

    await vi.waitFor(() => {
      expect(api.requests.map((request) => request.path)).toContain(
        `${listPath}&q=loyer`,
      )
    })
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Aucune opération')
    })
  })

  it('lists rows on mobile and warns that deleting a generated operation skips its occurrence', async () => {
    setViewportWidth(390)
    const generated = operation({ origin: 'schedule', label: 'Loyer' })
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET ${listPath}`]: () => page([generated]),
      [`DELETE /operations/${generated.id}`]: () => undefined,
    })
    const wrapper = await mountPage()
    await vi.waitFor(() => {
      expect(wrapper.findComponent(OperationRow).exists()).toBe(true)
    })

    wrapper.getComponent(OperationRow).vm.$emit('delete', generated)

    await vi.waitFor(() => {
      expect(document.body.textContent).toContain('marquée comme sautée')
    })
    findInBody('[data-testid="confirm-modal-confirm"]')?.click()
    await vi.waitFor(() => {
      expect(
        api.requests.some(
          (request) =>
            request.method === 'DELETE' &&
            request.path === `/operations/${generated.id}`,
        ),
      ).toBe(true)
    })
  })
})

describe('operation form (OPE-01, OPE-02)', () => {
  async function openEditor(open: () => void, ready: string) {
    await mountForm()
    open()
    await vi.waitFor(() => {
      expect(findInBody(ready)).not.toBeNull()
    })
  }

  it('records an expense on the first account, typed in euros and sent as a debit in cents', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /operations': () => operation(),
    })
    await openEditor(
      () => useOperationEditorStore().create('expense'),
      '[data-testid="operation-source"]',
    )
    await vi.waitFor(() => {
      expect(
        api.requests.some((request) => request.path === '/categories'),
      ).toBe(true)
    })

    await fillInput('[data-testid="operation-amount"]', '12,50')
    await fillInput('[data-testid="operation-label"]', 'Marché')
    submit('[data-testid="operation-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({
        accountId: ids.current,
        paymentMethodId: null,
        date: parisDate(new Date()),
        amountCents: -1_250,
        label: 'Marché',
        note: null,
        categoryId: null,
      })
    })
  })

  it('records a transfer between the first two accounts', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /transfers': () => ({
        transferGroupId: ids.transferGroup,
        source: operation({ transferGroupId: ids.transferGroup }),
        target: operation({
          id: '00000000-0000-4000-8000-0000000000d3',
          accountId: ids.livret,
          amountCents: 10_000,
          transferGroupId: ids.transferGroup,
        }),
      }),
    })
    await openEditor(
      () => useOperationEditorStore().create('transfer'),
      '[data-testid="operation-source-account"]',
    )
    await vi.waitFor(() => {
      expect(
        api.requests.some((request) => request.path === '/categories'),
      ).toBe(true)
    })

    await fillInput('[data-testid="operation-amount"]', '100')
    await fillInput('[data-testid="operation-label"]', 'Epargne')
    submit('[data-testid="operation-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({
        sourceAccountId: ids.current,
        targetAccountId: ids.livret,
        date: parisDate(new Date()),
        amountCents: 10_000,
        label: 'Epargne',
        note: null,
      })
    })
  })

  it('edits both movements of a transfer through its group', async () => {
    const movement = operation({
      accountId: ids.livret,
      amountCents: 10_000,
      categoryId: null,
      label: 'Epargne',
      transferGroupId: ids.transferGroup,
      counterpartAccountId: ids.current,
    })
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`PATCH /transfers/${ids.transferGroup}`]: () => ({
        transferGroupId: ids.transferGroup,
        source: operation({ transferGroupId: ids.transferGroup }),
        target: movement,
      }),
    })
    await openEditor(
      () => useOperationEditorStore().edit(movement),
      '[data-testid="operation-source-account"]',
    )

    await fillInput('[data-testid="operation-amount"]', '150')
    submit('[data-testid="operation-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'PATCH')?.body,
      ).toEqual(
        expect.objectContaining({
          sourceAccountId: ids.current,
          targetAccountId: ids.livret,
          amountCents: 15_000,
        }),
      )
    })
  })
})

describe('bank states and reconciliation (CHG-61, RAP-01, RAP-05, OPE-07)', () => {
  async function openEditor(open: () => void, ready: string) {
    await mountForm()
    open()
    await vi.waitFor(() => {
      expect(findInBody(ready)).not.toBeNull()
    })
  }

  it('shows the to-categorize, unconfirmed and reconciled marks of CHG-61', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const unconfirmed = await mountSuspended(OperationRow, {
      props: {
        operation: operation({ origin: 'schedule', unconfirmed: true }),
      },
    })
    const reconciled = await mountSuspended(OperationRow, {
      props: {
        operation: operation({
          origin: 'import',
          reconciled: true,
          status: 'to_categorize',
          categoryId: null,
        }),
      },
    })
    mounted.push(unconfirmed, reconciled)

    expect(unconfirmed.find('[data-testid="badge-unconfirmed"]').text()).toBe(
      'Non confirmée par la banque',
    )
    expect(reconciled.find('[data-testid="badge-reconciled"]').exists()).toBe(
      true,
    )
    expect(
      reconciled.find('[data-testid="badge-to-categorize"]').exists(),
    ).toBe(true)
  })

  it('proposes the best occurrence after a manual entry and reconciles it on confirmation', async () => {
    const created = operation({ id: '00000000-0000-4000-8000-0000000000d9' })
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /operations': () => created,
      [`GET /operations/${created.id}/candidates`]: () => ({
        candidates: [
          {
            scheduleId: ids.schedule,
            scheduleLabel: 'Loyer',
            originalDate: '2026-11-15',
            effectiveDate: '2026-11-15',
            amountCents: -60_000,
            operationId: null,
            score: 0.9,
          },
        ],
      }),
      [`POST /operations/${created.id}/reconcile`]: () =>
        operation({ ...created, reconciled: true }),
    })
    const proposal = await mountSuspended(ReconciliationProposalModal)
    mounted.push(proposal)
    await openEditor(
      () => useOperationEditorStore().create('expense'),
      '[data-testid="operation-source"]',
    )
    await vi.waitFor(() => {
      expect(
        api.requests.some((request) => request.path === '/categories'),
      ).toBe(true)
    })
    await fillInput('[data-testid="operation-amount"]', '600')
    await fillInput('[data-testid="operation-label"]', 'Loyer')
    submit('[data-testid="operation-form"]')

    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="reconciliation-proposal"]'),
      ).not.toBeNull()
    })
    await vi.waitFor(() => {
      const button = findInBody('[data-testid="reconciliation-confirm"]')
      expect(button instanceof HTMLButtonElement && !button.disabled).toBe(true)
    })
    findInBody('[data-testid="reconciliation-confirm"]')?.click()

    await vi.waitFor(() => {
      expect(
        api.requests.find(
          (request) => request.path === `/operations/${created.id}/reconcile`,
        )?.body,
      ).toEqual({ scheduleId: ids.schedule, originalDate: '2026-11-15' })
    })
  })

  it('dissociates a reconciled operation from its edit form', async () => {
    const reconciled = operation({
      origin: 'import',
      reconciled: true,
      scheduleId: ids.schedule,
      occurrenceDate: '2026-11-15',
      bankLabel: 'PRLV LOYER',
    })
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /operations/${reconciled.id}/candidates`]: () => ({
        candidates: [],
      }),
      [`DELETE /operations/${reconciled.id}/reconcile`]: () =>
        operation({ ...reconciled, reconciled: false, scheduleId: null }),
    })
    await openEditor(
      () => useOperationEditorStore().edit(reconciled),
      '[data-testid="operation-links"]',
    )

    expect(document.body.textContent).toContain('PRLV LOYER')
    findInBody('[data-testid="operation-dissociate"]')?.click()

    await vi.waitFor(() => {
      expect(
        api.requests.some(
          (request) =>
            request.method === 'DELETE' &&
            request.path === `/operations/${reconciled.id}/reconcile`,
        ),
      ).toBe(true)
    })
  })

  it('sends the reconciliation filters in the list query', () => {
    expect(
      operationQuery(
        { ...emptyOperationFilters(), reconciled: false, unconfirmed: true },
        { sort: 'date', order: 'desc' },
        1,
        50,
      ),
    ).toBe(
      'page=1&pageSize=50&sort=date&order=desc&reconciled=false&unconfirmed=true',
    )
  })
})
