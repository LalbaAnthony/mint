import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountGroupCard from '~/components/AccountGroupCard.vue'
import StatementsModal from '~/components/StatementsModal.vue'
import { installFakeApi } from '../fake-api'
import {
  account,
  euros,
  findInBody,
  referentialHandlers,
} from '../planning-fixtures'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []
const statementId = '00000000-0000-4000-8000-0000000000e9'

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

function statement(gapCents: number) {
  return {
    id: statementId,
    accountId: account().id,
    date: '2026-11-30',
    balanceCents: 123_750,
    calculatedBalanceCents: 123_750 - gapCents,
    gapCents,
    adjustmentOperationId: null,
  }
}

describe('statements and gap (CPT-05, CPT-08, US-05)', () => {
  it('flags an account whose latest statement keeps a gap', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const withGap = account({ reconciliationGapCents: -1_250 })
    const wrapper = await mountInApp(AccountGroupCard, {
      props: {
        group: { usage: 'current', subtotalCents: 0, accounts: [withGap] },
        paymentMethods: [],
        reordering: false,
        expandedIds: [],
      },
    })
    mounted.push(wrapper)

    expect(wrapper.get('[data-testid="account-gap"]').text()).toBe(
      'Écart non résolu',
    )
  })

  it('shows the gap of -12.50 EUR and corrects it', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /accounts/${account().id}/statements`]: () => ({
        statements: [statement(-1_250)],
      }),
      [`POST /statements/${statementId}/adjust`]: () => statement(0),
    })
    const wrapper = await mountInApp(StatementsModal, {
      props: { open: true, account: account() },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(
        findInBody('[data-testid="statement-gap"]')?.textContent,
      ).toContain(euros(-1_250, 'exceptZero'))
    })
    findInBody('[data-testid="statement-adjust"]')?.click()

    await vi.waitFor(() => {
      expect(
        api.requests.some(
          (request) =>
            request.method === 'POST' &&
            request.path === `/statements/${statementId}/adjust`,
        ),
      ).toBe(true)
    })
    expect(
      wrapper.getComponent(StatementsModal).emitted('changed'),
    ).toBeDefined()
  })
})
