import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OperationFormModal from '~/components/OperationFormModal.vue'
import TagManager from '~/components/TagManager.vue'
import TagSelect from '~/components/TagSelect.vue'
import OperationsPage from '~/pages/operations/index.vue'
import { installFakeApi } from '../fake-api'
import {
  fillInput,
  findInBody,
  holidaysTag,
  ids,
  operation,
  referentialHandlers,
  submit,
} from '../planning-fixtures'
import { mountInApp } from '../app'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

const worksTag = {
  id: '00000000-0000-4000-8000-0000000000a8',
  name: 'Travaux',
  operationCount: 0,
  scheduleCount: 2,
  ruleCount: 1,
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  useOperationEditorStore().isOpen = false
  useReferentialsStore().tags = []
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('tags (CAT-09)', () => {
  it('lists the tags with their usage and creates one from the profile', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /tags': () => [holidaysTag, worksTag],
      'POST /tags': () => ({
        id: '00000000-0000-4000-8000-0000000000a9',
        name: 'Santé',
        operationCount: 0,
        scheduleCount: 0,
        ruleCount: 0,
      }),
    })
    const wrapper = await mountInApp(TagManager)
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Travaux')
    })
    expect(
      wrapper.get(`[data-testid="tag-row-${ids.holidays}"]`).text(),
    ).toContain('1 opération · aucune échéance · aucune règle')
    expect(
      wrapper.get(`[data-testid="tag-row-${worksTag.id}"]`).text(),
    ).toContain('aucune opération · 2 échéances · 1 règle')

    await wrapper.get('[data-testid="tags-add"]').trigger('click')
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="tag-name"]')).not.toBeNull()
    })
    await fillInput('[data-testid="tag-name"]', 'Santé')
    submit('[data-testid="tag-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'POST')?.body,
      ).toEqual({ name: 'Santé' })
    })
  })

  it('states what a deletion removes before deleting the tag', async () => {
    const api = installFakeApi(fetchMock, {
      'GET /tags': () => [worksTag],
      [`DELETE /tags/${worksTag.id}`]: () => undefined,
    })
    const wrapper = await mountInApp(TagManager)
    mounted.push(wrapper)
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Travaux')
    })

    const menu = wrapper.getComponent({ name: 'UDropdownMenu' })
    const items: unknown = menu.props('items')
    const remove = Array.isArray(items) ? items[1]?.[0] : undefined
    remove?.onSelect()
    await vi.waitFor(() => {
      expect(document.body.textContent).toContain(
        'Travaux sera supprimé définitivement et retiré de ses usages (aucune opération · 2 échéances · 1 règle).',
      )
    })
    findInBody('[data-testid="confirm-modal-confirm"]')?.click()

    await vi.waitFor(() => {
      expect(api.requests.some((request) => request.method === 'DELETE')).toBe(
        true,
      )
    })
  })

  it('creates a missing tag from the selector and selects it', async () => {
    installFakeApi(fetchMock, {
      'GET /tags': () => [holidaysTag],
      'POST /tags': () => worksTag,
    })
    const selected = ref<string[]>([ids.holidays])
    const wrapper = await mountInApp(TagSelect, {
      props: {
        modelValue: selected.value,
        'onUpdate:modelValue': (value: string[]) => {
          selected.value = value
        },
      },
    })
    mounted.push(wrapper)
    await useReferentialsStore().loadTags()

    wrapper.getComponent({ name: 'USelectMenu' }).vm.$emit('create', 'Travaux')

    await vi.waitFor(() => {
      expect(selected.value).toEqual([ids.holidays, worksTag.id])
    })
    expect(useReferentialsStore().tags.map((tag) => tag.name)).toEqual([
      'Travaux',
      'Vacances',
    ])
  })

  it('shows the tags of each operation and filters on them', async () => {
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      'GET /operations?page=1&pageSize=50&sort=date&order=desc': () => ({
        items: [operation({ tagIds: [ids.holidays] })],
        total: 1,
        page: 1,
        pageSize: 50,
      }),
    })
    const wrapper = await mountInApp(OperationsPage, {
      route: '/operations',
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="tag-badges"]').text()).toBe('Vacances')
    })
    expect(
      operationQuery(
        { ...emptyOperationFilters(), tagIds: [ids.holidays, worksTag.id] },
        { sort: 'date', order: 'desc' },
        1,
        50,
        'fr',
      ),
    ).toBe(
      `page=1&pageSize=50&sort=date&order=desc&tagIds=${ids.holidays}&tagIds=${worksTag.id}`,
    )
  })

  it('keeps the tags of an edited operation in the request', async () => {
    const tagged = operation({ tagIds: [ids.holidays] })
    const api = installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`PATCH /operations/${tagged.id}`]: () => ({
        ...tagged,
        capWarnings: [],
      }),
    })
    const wrapper = await mountInApp(OperationFormModal)
    mounted.push(wrapper)
    useOperationEditorStore().edit(tagged)
    await vi.waitFor(() => {
      expect(findInBody('[data-testid="operation-tags"]')).not.toBeNull()
    })

    submit('[data-testid="operation-form"]')

    await vi.waitFor(() => {
      expect(
        api.requests.find((request) => request.method === 'PATCH')?.body,
      ).toEqual(expect.objectContaining({ tagIds: [ids.holidays] }))
    })
  })
})
