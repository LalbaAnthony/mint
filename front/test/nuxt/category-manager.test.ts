import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Category } from '@mint/shared/types/categories'
import CategoryManager from '~/components/CategoryManager.vue'
import { installFakeApi } from '../fake-api'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

function category(
  id: string,
  name: string,
  overrides: Partial<Category> = {},
): Category {
  return {
    id: `00000000-0000-4000-8000-0000000000${id}`,
    parentId: null,
    kind: 'expense',
    expenseGroup: 'needs',
    name,
    isSystem: false,
    sortOrder: 0,
    archivedAt: null,
    ...overrides,
  }
}

const housing = category('01', 'Logement')
const groceries = category('02', 'Courses', { sortOrder: 1 })
const rent = category('03', 'Loyer', { parentId: housing.id })
const works = category('04', 'Travaux', {
  parentId: housing.id,
  sortOrder: 1,
  archivedAt: '2026-11-01T10:00:00.000Z',
})
const leisure = category('05', 'Loisirs', { expenseGroup: 'wants' })
const salary = category('06', 'Salaire', {
  kind: 'income',
  expenseGroup: null,
})
const interest = category('07', 'Interest', {
  kind: 'income',
  expenseGroup: null,
  isSystem: true,
  sortOrder: 18,
})
const adjustment = category('08', 'Adjustment', {
  kind: 'adjustment',
  expenseGroup: null,
  isSystem: true,
  sortOrder: 19,
})

const categories = [
  housing,
  groceries,
  rent,
  works,
  leisure,
  salary,
  interest,
  adjustment,
]

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

async function mountManager() {
  const api = installFakeApi(fetchMock, {
    'GET /categories': () => categories,
    'POST /categories/reorder': () => undefined,
  })
  const wrapper = await mountSuspended(CategoryManager)
  await vi.waitFor(() => {
    expect(
      wrapper.find(`[data-testid="category-${housing.id}"]`).exists(),
    ).toBe(true)
  })
  return { api, wrapper }
}

describe('category management (CAT-01 to CAT-08)', () => {
  it('shows Needs, Wants, income and system sections with subcategories under their parent', async () => {
    const { wrapper } = await mountManager()

    const section = (id: string) =>
      wrapper.get(`[data-testid="category-section-${id}"]`)
    expect(section('needs').text()).toContain('Besoins')
    expect(
      section('needs')
        .findAll('[data-testid="category-name"]')
        .map((name) => name.text()),
    ).toEqual(['Logement', 'Loyer', 'Travaux', 'Courses'])
    expect(section('wants').text()).toContain('Loisirs')
    expect(section('income').text()).toContain('Salaire')
    expect(section('income').text()).not.toContain('Interest')
    expect(
      wrapper.get(`[data-testid="category-${works.id}"]`).text(),
    ).toContain('Archivée')
  })

  it('names the system categories in the interface language and offers no action on them', async () => {
    const { wrapper } = await mountManager()

    const system = wrapper.get('[data-testid="category-section-system"]')
    expect(
      system
        .findAll('[data-testid="category-name"]')
        .map((name) => name.text()),
    ).toEqual(['Intérêts', 'Ajustement'])
    expect(system.text()).toContain('Système')
    expect(system.find('[data-testid="category-actions"]').exists()).toBe(false)
  })

  it('reorders first-level categories of one group with the move buttons', async () => {
    const { api, wrapper } = await mountManager()

    await wrapper.get('[data-testid="categories-reorder"]').trigger('click')
    const system = wrapper.get('[data-testid="category-section-system"]')
    expect(system.find('[data-testid="move-up"]').exists()).toBe(false)
    await wrapper
      .get(`[data-testid="category-${housing.id}"]`)
      .findAll('[data-testid="move-down"]')[0]
      ?.trigger('click')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.path === '/categories/reorder')
          ?.body,
      ).toEqual({ categoryIds: [groceries.id, housing.id] })
    })
  })

  it('reorders the subcategories of one parent', async () => {
    const { api, wrapper } = await mountManager()

    await wrapper.get('[data-testid="categories-reorder"]').trigger('click')
    await wrapper
      .get(`[data-testid="category-${works.id}"]`)
      .get('[data-testid="move-up"]')
      .trigger('click')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.path === '/categories/reorder')
          ?.body,
      ).toEqual({ categoryIds: [works.id, rent.id] })
    })
  })
})

describe('category form', () => {
  it('creates a first-level expense category in the chosen group', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /categories': () => categories,
      'POST /categories': () => category('09', 'Animaux'),
    })
    const wrapper = await mountSuspended(CategoryManager)
    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="categories-add"]').exists()).toBe(true)
    })

    await wrapper.get('[data-testid="categories-add"]').trigger('click')
    await vi.waitFor(() => {
      expect(
        document.body.querySelector('[data-testid="category-form"]'),
      ).not.toBeNull()
    })
    const input = document.body.querySelector(
      '[data-testid="category-name-input"] input, input[data-testid="category-name-input"]',
    )
    if (!(input instanceof HTMLInputElement)) {
      throw new Error('No category name input')
    }
    input.value = 'Animaux'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    document.body
      .querySelector('[data-testid="category-form"]')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({
        kind: 'expense',
        name: 'Animaux',
        parentId: null,
        expenseGroup: 'needs',
      })
    })
  })
})
