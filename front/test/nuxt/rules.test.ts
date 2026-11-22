import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Rule } from '@mint/shared/types/rules'
import RulesPage from '~/pages/rules/index.vue'
import { installFakeApi } from '../fake-api'
import {
  fillInput,
  findInBody,
  ids,
  referentialHandlers,
  submit,
} from '../planning-fixtures'
import { mountInApp } from '../app'

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

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: '00000000-0000-4000-8000-0000000000r1'.replace('r', '1'),
    priority: 0,
    matchType: 'contains',
    pattern: 'DEEZER',
    accountId: null,
    sign: 'any',
    amountMinCents: null,
    amountMaxCents: null,
    categoryId: ids.leisure,
    transferAccountId: null,
    tagIds: [],
    active: true,
    ...overrides,
  }
}

describe('rules view (REG-01 to REG-03)', () => {
  it('lists the rules in priority order with their condition and action', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /rules': () => [
        rule(),
        rule({
          id: '00000000-0000-4000-8000-000000000112',
          priority: 1,
          pattern: 'EDF',
          sign: 'debit',
          active: false,
        }),
      ],
    })

    const wrapper = await mountInApp(RulesPage, { route: '/rules' })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="rules-list"]').text()).toContain(
        'DEEZER',
      )
    })
    const text = wrapper.get('[data-testid="rules-list"]').text()
    expect(text.indexOf('DEEZER')).toBeLessThan(text.indexOf('EDF'))
    expect(text).toContain('Contient')
    expect(text).toContain('Débits')
    expect(text).toContain('Inactive')
  })

  it('opens the form prefilled from an imported operation and creates the rule', async () => {
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /rules': () => [],
      [`GET /rules/suggestion?operationId=${ids.operation}`]: () => ({
        matchType: 'contains',
        pattern: 'PRLV SEPA DEEZER',
        accountId: null,
        sign: 'debit',
        categoryId: ids.leisure,
        transferAccountId: null,
        tagIds: [ids.holidays],
      }),
      'POST /rules': () => rule({ pattern: 'PRLV SEPA DEEZER' }),
    })

    const wrapper = await mountInApp(RulesPage, {
      route: `/rules?operation=${ids.operation}`,
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(findInBody('[data-testid="rule-form"]')).not.toBeNull()
    })
    const pattern =
      findInBody('[data-testid="rule-pattern"] input') ??
      findInBody('[data-testid="rule-pattern"]')
    expect(pattern instanceof HTMLInputElement && pattern.value).toBe(
      'PRLV SEPA DEEZER',
    )
    await fillInput('[data-testid="rule-pattern"]', 'DEEZER')
    submit('[data-testid="rule-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({
        matchType: 'contains',
        pattern: 'DEEZER',
        accountId: null,
        sign: 'debit',
        amountMinCents: null,
        amountMaxCents: null,
        categoryId: ids.leisure,
        transferAccountId: null,
        tagIds: [ids.holidays],
        active: true,
      })
    })
  })
})
