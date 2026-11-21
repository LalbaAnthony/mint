import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type {
  CsvMapping,
  ImportBatchView,
  ImportRow,
} from '@mint/shared/types/imports'
import ImportMappingForm from '~/components/ImportMappingForm.vue'
import ImportPage from '~/pages/import/index.vue'
import { installFakeApi } from '../fake-api'
import {
  ids,
  overview,
  account,
  card,
  categories,
  focusedTestId,
  livret,
} from '../planning-fixtures'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []
const batchId = '00000000-0000-4000-8000-0000000000bb'

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

const mapping: CsvMapping = {
  delimiter: 'semicolon',
  encoding: 'windows-1252',
  hasHeader: true,
  skipTop: 0,
  skipBottom: 0,
  dateFormat: 'DD/MM/YYYY',
  decimalSeparator: 'comma',
  colDate: 0,
  colLabel: 1,
  colAmount: null,
  colDebit: 2,
  colCredit: 3,
}

function row(overrides: Partial<ImportRow> & { rowIndex: number }): ImportRow {
  return {
    raw: [],
    date: '2026-12-07',
    amountCents: 18_700,
    bankLabel: 'VIR PRESTATION',
    error: null,
    duplicate: false,
    ruleId: null,
    categoryId: null,
    transferAccountId: null,
    tagIds: [],
    candidates: [],
    ...overrides,
  }
}

function view(overrides: Partial<ImportBatchView> = {}): ImportBatchView {
  return {
    batch: {
      id: batchId,
      accountId: ids.current,
      filename: 'releve.csv',
      status: 'pending',
      rowsRead: 0,
      rowsCreated: 0,
      rowsDuplicate: 0,
      rowsMerged: 0,
      createdAt: '2026-12-08T10:00:00.000Z',
      validatedAt: null,
      cancelledAt: null,
    },
    mapping,
    mappingRemembered: true,
    sampleLines: [['Date', 'Libellé', 'Débit', 'Crédit']],
    rows: [],
    ...overrides,
  }
}

const previewed = view({
  rows: [
    row({
      rowIndex: 1,
      candidates: [
        {
          scheduleId: ids.schedule,
          scheduleLabel: 'Prestation',
          originalDate: '2026-12-05',
          effectiveDate: '2026-12-05',
          amountCents: 20_000,
          operationId: ids.operation,
          score: 0.8,
        },
      ],
    }),
    row({
      rowIndex: 2,
      bankLabel: 'CB BOULANGERIE',
      amountCents: -450,
      duplicate: true,
    }),
    row({
      rowIndex: 3,
      error: 'invalid_date',
      date: null,
      raw: ['32/12/2026', 'CB X', '1,00', ''],
    }),
  ],
})

function handlers() {
  return {
    'GET /accounts/overview': () => overview([account()]),
    'GET /payment-methods': () => [card],
    'GET /categories': () => categories,
    'GET /tags': () => [],
    [`GET /accounts/${ids.current}/imports`]: () => ({
      batches: [
        {
          ...view().batch,
          id: '00000000-0000-4000-8000-0000000000cc',
          status: 'validated',
          rowsRead: 12,
          rowsCreated: 10,
          rowsDuplicate: 2,
          validatedAt: '2026-12-01T10:00:00.000Z',
        },
      ],
    }),
    [`POST /accounts/${ids.current}/imports?filename=releve.csv`]: () => view(),
    [`POST /imports/${batchId}/preview`]: () => previewed,
    [`POST /imports/${batchId}/validate`]: () => ({
      ...view().batch,
      status: 'validated',
      rowsRead: 3,
      rowsMerged: 1,
      validatedAt: '2026-12-08T10:00:00.000Z',
    }),
  }
}

describe('import view (IMP-01 to IMP-08)', () => {
  it('uploads the file, applies the remembered settings and validates the reviewed lines', async () => {
    const api = installFakeApi(fetchMock, handlers())
    const wrapper = await mountSuspended(ImportPage, { route: '/import' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="import-history"]').text()).toContain(
        '12 lues, 10 créées, 2 doublons exclus',
      )
    })
    const input = wrapper.get('[data-testid="import-file"]').element
    Object.defineProperty(input, 'files', {
      value: [new File(['Date;Libellé'], 'releve.csv', { type: 'text/csv' })],
    })
    input.dispatchEvent(new Event('change'))
    await nextTick()
    await wrapper.get('[data-testid="import-upload"]').trigger('click')

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="import-review"]').exists()).toBe(true)
    })
    expect(api.requests.map((request) => request.path)).toContain(
      `/imports/${batchId}/preview`,
    )
    expect(
      wrapper
        .get('[data-testid="import-include-2"]')
        .attributes('aria-checked'),
    ).toBe('false')

    await wrapper.get('[data-testid="import-filter"]').trigger('click')
    await wrapper.get('[data-testid="import-validate"]').trigger('click')

    await vi.waitFor(() => {
      expect(
        api.requests.find(
          (request) => request.path === `/imports/${batchId}/validate`,
        )?.body,
      ).toEqual({
        mapping,
        decisions: [
          {
            rowIndex: 1,
            include: true,
            categoryId: null,
            transferAccountId: null,
            reconcile: { scheduleId: ids.schedule, originalDate: '2026-12-05' },
          },
          {
            rowIndex: 2,
            include: false,
            categoryId: null,
            transferAccountId: null,
            reconcile: null,
          },
        ],
      })
    })
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="import-select"]').exists()).toBe(true)
    })
  })
})

describe('import autofocus (CHG-69)', () => {
  async function mountPage() {
    const wrapper = await mountSuspended(ImportPage, {
      route: '/import',
      attachTo: document.body,
    })
    mounted.push(wrapper)
  }

  it('focuses the account when several accounts can receive the file', async () => {
    installFakeApi(fetchMock, {
      ...handlers(),
      'GET /accounts/overview': () => overview([account(), livret]),
    })
    await mountPage()

    await vi.waitFor(() => {
      expect(focusedTestId()).toBe('import-account')
    })
  })

  it('focuses the file once the only account is preselected', async () => {
    installFakeApi(fetchMock, handlers())
    await mountPage()

    await vi.waitFor(() => {
      expect(focusedTestId()).toBe('import-file')
    })
  })

  it('counts the default debit and credit columns as values', async () => {
    const wrapper = await mountSuspended(ImportMappingForm, {
      props: {
        view: view({
          mapping: { ...mapping, colDebit: null, colCredit: null },
        }),
        busy: false,
      },
      attachTo: document.body,
    })
    mounted.push(wrapper)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await nextTick()

    expect(focusedTestId()).toBeNull()
  })
})
