import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OperationFormModal from '~/components/OperationFormModal.vue'
import OperationRow from '~/components/OperationRow.vue'
import ReconciliationProposalModal from '~/components/ReconciliationProposalModal.vue'
import ReapplyRulesModal from '~/components/ReapplyRulesModal.vue'
import OperationsPage from '~/pages/operations/index.vue'
import { installFakeApi } from '../fake-api'
import {
  euros,
  fillInput,
  findInBody,
  ids,
  livret,
  operation,
  overview,
  referentialHandlers,
  selectByTestId,
  setViewportWidth,
  submit,
  typeInto,
} from '../planning-fixtures'
import { setDefaultAccount } from '../session'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const listPath = '/operations?page=1&pageSize=50&sort=date&order=desc'
const initialWidth = window.innerWidth
const mounted: { unmount: () => void }[] = []

async function mountPage() {
  const wrapper = await mountInApp(OperationsPage, { route: '/operations' })
  mounted.push(wrapper)
  return wrapper
}

async function mountForm() {
  const wrapper = await mountInApp(OperationFormModal)
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
    const wrapper = await mountForm()
    open()
    await vi.waitFor(() => {
      expect(findInBody(ready)).not.toBeNull()
    })
    return wrapper
  }

  async function chooseTarget(
    wrapper: Awaited<ReturnType<typeof mountForm>>,
    accountId: string,
  ) {
    const target = selectByTestId(wrapper, 'operation-target-account')
    expect(target?.value()).toBeUndefined()
    target?.choose(accountId)
    await vi.waitFor(() => {
      expect(target?.value()).toBe(accountId)
    })
  }

  it('records an expense on the default account, typed in euros and sent as a debit in cents (ADR 0033)', async () => {
    setDefaultAccount(ids.livret)
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /operations': () => ({ ...operation(), capWarnings: [] }),
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
        accountId: ids.livret,
        paymentMethodId: null,
        date: parisDate(new Date()),
        amountCents: -1_250,
        label: 'Marché',
        note: null,
        categoryId: null,
        tagIds: [],
      })
    })
  })

  it('leaves the payment source empty without default account among several accounts (ADR 0033)', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const wrapper = await mountForm()

    useOperationEditorStore().create('expense')

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="operation-source"]')).not.toBeNull()
    })
    await vi.waitFor(() => {
      expect(useReferentialsStore().activeAccounts).toHaveLength(2)
    })
    expect(selectByTestId(wrapper, 'operation-source')?.value()).toBeUndefined()
  })

  it('preselects the only active account without default account (ADR 0033)', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /accounts/overview': () => overview([livret]),
    })
    const wrapper = await mountForm()

    useOperationEditorStore().create('expense')

    await vi.waitFor(() => {
      expect(selectByTestId(wrapper, 'operation-source')?.value()).toBe(
        `account:${ids.livret}`,
      )
    })
  })

  it('records a transfer from the default account to the chosen target (ADR 0033)', async () => {
    setDefaultAccount(ids.current)
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
        capWarnings: [],
      }),
    })
    const wrapper = await openEditor(
      () => useOperationEditorStore().create('transfer'),
      '[data-testid="operation-source-account"]',
    )
    await vi.waitFor(() => {
      expect(selectByTestId(wrapper, 'operation-source-account')?.value()).toBe(
        ids.current,
      )
    })

    await chooseTarget(wrapper, ids.livret)
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
        tagIds: [],
      })
    })
  })

  it('warns without blocking when a transfer exceeds the cap of a passbook (LIV-02, US-15)', async () => {
    setDefaultAccount(ids.current)
    const today = parisDate(new Date())
    installFakeApi(fetchMock, {
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
        capWarnings: [
          { accountId: ids.livret, date: today, excessCents: 5_000 },
        ],
      }),
    })
    const wrapper = await openEditor(
      () => useOperationEditorStore().create('transfer'),
      '[data-testid="operation-source-account"]',
    )
    await vi.waitFor(() => {
      expect(selectByTestId(wrapper, 'operation-source-account')?.value()).toBe(
        ids.current,
      )
    })
    await chooseTarget(wrapper, ids.livret)
    await fillInput('[data-testid="operation-amount"]', '100')
    await fillInput('[data-testid="operation-label"]', 'Epargne')
    submit('[data-testid="operation-form"]')

    const expected = `Livret A dépasse son plafond de ${euros(5_000)} au ${new Intl.DateTimeFormat(
      'fr',
      { dateStyle: 'medium', timeZone: 'UTC' },
    ).format(new Date(`${today}T00:00:00Z`))}.`
    await vi.waitFor(() => {
      expect(useToast().toasts.value.map((toast) => toast.title)).toContain(
        expected,
      )
    })
    expect(
      useToast().toasts.value.find((toast) => toast.title === expected)?.color,
    ).toBe('warning')
    useToast().clear()
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
        capWarnings: [],
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
    const unconfirmed = await mountInApp(OperationRow, {
      props: {
        operation: operation({ origin: 'schedule', unconfirmed: true }),
      },
    })
    const reconciled = await mountInApp(OperationRow, {
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
    setDefaultAccount(ids.current)
    const created = operation({ id: '00000000-0000-4000-8000-0000000000d9' })
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /operations': () => ({ ...created, capWarnings: [] }),
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
    const proposal = await mountInApp(ReconciliationProposalModal)
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
        'fr',
      ),
    ).toBe(
      'page=1&pageSize=50&sort=date&order=desc&reconciled=false&unconfirmed=true',
    )
  })
})

describe('reapplying the rules to a selection (REG-05)', () => {
  const ruleId = '00000000-0000-4000-8000-0000000000e9'
  const second = operation({
    id: '00000000-0000-4000-8000-0000000000d2',
    label: 'PRLV DEEZER',
    bankLabel: 'PRLV DEEZER 06/12',
    categoryId: ids.groceries,
  })

  function previewWithOneChange() {
    return {
      changes: [
        {
          operation: second,
          after: {
            operationId: second.id,
            ruleId,
            categoryId: ids.leisure,
            transferAccountId: null,
            tagIds: [ids.holidays],
          },
        },
      ],
      skipped: [{ operationId: ids.operation, reason: 'no_bank_label' }],
    }
  }

  function rules() {
    return [
      {
        id: ruleId,
        priority: 0,
        matchType: 'contains',
        pattern: 'DEEZER',
        accountId: null,
        sign: 'any',
        amountMinCents: null,
        amountMaxCents: null,
        categoryId: ids.leisure,
        transferAccountId: null,
        tagIds: [ids.holidays],
        active: true,
      },
    ]
  }

  it('selects the operations of the page and opens the preview', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET ${listPath}`]: () => page([operation(), second]),
      'POST /rules/reapply/preview': () => previewWithOneChange(),
      'GET /rules': () => rules(),
    })
    const wrapper = await mountPage()
    await vi.waitFor(() => {
      expect(
        wrapper.find('[data-testid="operations-select-page"]').exists(),
      ).toBe(true)
    })
    expect(wrapper.find('[data-testid="operations-reapply"]').exists()).toBe(
      false,
    )

    await wrapper.get('[data-testid="operations-select-page"]').trigger('click')

    await vi.waitFor(() => {
      expect(
        wrapper.get('[data-testid="operations-selected-count"]').text(),
      ).toBe('2 opérations sélectionnées')
    })
    await wrapper.get('[data-testid="operations-reapply"]').trigger('click')

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="reapply-preview"]')).not.toBeNull()
    })
    expect(
      api.requests.find((request) => request.path === '/rules/reapply/preview')
        ?.body,
    ).toEqual({ operationIds: [ids.operation, second.id] })
  })

  it('shows each change and the skipped operations, then applies the kept changes', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /rules/reapply/preview': () => previewWithOneChange(),
      'GET /rules': () => rules(),
      'POST /rules/reapply': () => ({ updated: 1 }),
    })
    const wrapper = await mountInApp(ReapplyRulesModal, {
      props: { open: true, operationIds: [ids.operation, second.id] },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="reapply-preview"]')).not.toBeNull()
    })
    const change = findInBody(`[data-testid="reapply-change-${second.id}"]`)
    expect(change?.textContent).toContain('Règle « DEEZER »')
    expect(change?.textContent).toContain('Courses')
    expect(
      findInBody('[data-testid="reapply-after"]')?.textContent?.trim(),
    ).toBe('Loisirs')
    expect(change?.textContent).toContain('Vacances')
    expect(
      findInBody('[data-testid="reapply-skipped"]')?.textContent?.trim(),
    ).toBe('1 sans libellé bancaire')
    expect(
      findInBody('[data-testid="reapply-confirm"]')?.textContent,
    ).toContain('Appliquer à 1 opération')

    findInBody('[data-testid="reapply-confirm"]')?.click()

    await vi.waitFor(() => {
      expect(
        wrapper.getComponent(ReapplyRulesModal).emitted('applied'),
      ).toEqual([[1]])
    })
    expect(
      api.requests.find((request) => request.path === '/rules/reapply')?.body,
    ).toEqual({ changes: [previewWithOneChange().changes[0]?.after] })
  })

  it('disables the confirmation when every change is unchecked', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'POST /rules/reapply/preview': () => previewWithOneChange(),
      'GET /rules': () => rules(),
    })
    const wrapper = await mountInApp(ReapplyRulesModal, {
      props: { open: true, operationIds: [second.id] },
    })
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="reapply-keep"]')).not.toBeNull()
    })

    findInBody('[data-testid="reapply-keep"]')?.click()

    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="reapply-confirm"]')?.hasAttribute('disabled'),
      ).toBe(true)
    })
  })
})
