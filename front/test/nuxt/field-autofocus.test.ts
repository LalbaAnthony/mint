import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive, ref } from 'vue'
import type { Component } from 'vue'
import { USelect } from '#components'
import AppForm from '~/components/AppForm.vue'
import AppFormField from '~/components/AppFormField.vue'
import CategoryDeleteModal from '~/components/CategoryDeleteModal.vue'
import OperationFormModal from '~/components/OperationFormModal.vue'
import TagFormModal from '~/components/TagFormModal.vue'
import { installFakeApi } from '../fake-api'
import {
  categories,
  findInBody,
  focusedTestId,
  ids,
  operation,
  referentialHandlers,
} from '../planning-fixtures'
import { setDefaultAccount } from '../session'

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }))

mockNuxtImport('$fetch', () => fetchMock)

const mounted: { unmount: () => void }[] = []

const kindItems = [
  { label: 'Dépense', value: 'expense' },
  { label: 'Revenu', value: 'income' },
]

function textField(name: string, testId: string, disabled = false) {
  return h(
    AppFormField,
    { label: name, name },
    { default: () => h('input', { 'data-testid': testId, disabled }) },
  )
}

function selectField(name: string, testId: string, value: string | undefined) {
  return h(
    AppFormField,
    { label: name, name },
    {
      default: () =>
        h(USelect, {
          modelValue: value,
          items: kindItems,
          'data-testid': testId,
        }),
    },
  )
}

async function mountAttached(component: Component) {
  const wrapper = await mountSuspended(component, { attachTo: document.body })
  mounted.push(wrapper)
  await nextTick()
  await nextTick()
  return wrapper
}

beforeEach(() => {
  resetCsrfToken()
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  useOperationEditorStore().isOpen = false
  fetchMock.mockReset()
  document.body.innerHTML = ''
})

describe('field value lookup', () => {
  it('reads a value by its dotted field name', () => {
    expect(
      lookupFieldValue({ targets: { needs: 50 } }, 'targets.needs'),
    ).toEqual({ tracked: true, value: 50 })
    expect(lookupFieldValue({ source: undefined }, 'source')).toEqual({
      tracked: true,
      value: undefined,
    })
  })

  it('does not track a name that is not a key of the values', () => {
    expect(lookupFieldValue({ label: '' }, 'counterpartAccountId')).toEqual({
      tracked: false,
    })
    expect(lookupFieldValue({ targets: null }, 'targets.needs')).toEqual({
      tracked: false,
    })
  })

  it('counts an empty string, null, undefined and an empty list as no value', () => {
    for (const empty of ['', null, undefined, []]) {
      expect(isEmptyFieldValue(empty)).toBe(true)
    }
    for (const filled of ['a', 0, false, ['tag']]) {
      expect(isEmptyFieldValue(filled)).toBe(false)
    }
  })
})

describe('AppForm autofocus (CHG-69)', () => {
  it('focuses the first field without a value, past a prefilled select and a filled input', async () => {
    await mountAttached(
      defineComponent({
        setup: () => {
          const state = reactive({ kind: 'expense', name: 'Courses', note: '' })
          return () =>
            h(AppForm, { state }, () => [
              selectField('kind', 'kind', state.kind),
              textField('name', 'name'),
              textField('note', 'note'),
            ])
        },
      }),
    )

    expect(focusedTestId()).toBe('note')
  })

  it('focuses an empty select', async () => {
    await mountAttached(
      defineComponent({
        setup: () => {
          const state = reactive({ kind: undefined, note: '' })
          return () =>
            h(AppForm, { state }, () => [
              selectField('kind', 'kind', state.kind),
              textField('note', 'note'),
            ])
        },
      }),
    )

    expect(focusedTestId()).toBe('kind')
  })

  it('leaves the focus alone when every field has a value', async () => {
    await mountAttached(
      defineComponent({
        setup: () => {
          const state = reactive({ kind: 'income', name: 'Salaire' })
          return () =>
            h(AppForm, { state }, () => [
              selectField('kind', 'kind', state.kind),
              textField('name', 'name'),
            ])
        },
      }),
    )

    expect(focusedTestId()).toBeNull()
  })

  it('skips fields that are disabled or not part of the state', async () => {
    await mountAttached(
      defineComponent({
        setup: () => {
          const state = reactive({ locked: '', note: '' })
          return () =>
            h(AppForm, { state }, () => [
              textField('counterpart', 'counterpart'),
              textField('locked', 'locked', true),
              textField('note', 'note'),
            ])
        },
      }),
    )

    expect(focusedTestId()).toBe('note')
  })

  it('waits for the defaults set while pending before choosing the field', async () => {
    const pending = ref(true)
    const state = reactive<{ kind: string | undefined; note: string }>({
      kind: undefined,
      note: '',
    })
    await mountAttached(
      defineComponent({
        setup: () => () =>
          h(AppForm, { state, pending: pending.value }, () => [
            selectField('kind', 'kind', state.kind),
            textField('note', 'note'),
          ]),
      }),
    )
    expect(focusedTestId()).toBeNull()

    state.kind = 'expense'
    pending.value = false
    await nextTick()
    await nextTick()

    expect(focusedTestId()).toBe('note')
  })

  it('does not focus a field that appears after the form', async () => {
    const revealed = ref(false)
    await mountAttached(
      defineComponent({
        setup: () => {
          const state = reactive({ name: 'Courses', extra: '' })
          return () =>
            h(AppForm, { state }, () => [
              textField('name', 'name'),
              revealed.value ? textField('extra', 'extra') : null,
            ])
        },
      }),
    )

    revealed.value = true
    await nextTick()
    await nextTick()

    expect(findInBody('[data-testid="extra"]')).not.toBeNull()
    expect(focusedTestId()).toBeNull()
  })
})

describe('form autofocus in the modals (CHG-69)', () => {
  it('focuses the name of a new tag', async () => {
    const wrapper = await mountSuspended(TagFormModal, {
      props: { open: true, tag: null },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(focusedTestId()).toBe('tag-name')
    })
  })

  it('focuses the amount of a new expense once the payment source is prefilled', async () => {
    setDefaultAccount(ids.current)
    installFakeApi(fetchMock, referentialHandlers())
    const wrapper = await mountSuspended(OperationFormModal)
    mounted.push(wrapper)

    useOperationEditorStore().create('expense')

    await vi.waitFor(() => {
      expect(focusedTestId()).toBe('operation-amount')
    })
  })

  it('focuses the payment source of a new expense without default account (ADR 0033)', async () => {
    installFakeApi(fetchMock, referentialHandlers())
    const wrapper = await mountSuspended(OperationFormModal)
    mounted.push(wrapper)

    useOperationEditorStore().create('expense')

    await vi.waitFor(() => {
      expect(focusedTestId()).toBe('operation-source')
    })
  })

  it('focuses the category when editing an operation without one', async () => {
    const uncategorized = operation({
      categoryId: null,
      status: 'to_categorize',
    })
    installFakeApi(fetchMock, {
      ...referentialHandlers(),
      [`GET /operations/${uncategorized.id}/candidates`]: () => ({
        candidates: [],
      }),
    })
    const wrapper = await mountSuspended(OperationFormModal)
    mounted.push(wrapper)

    useOperationEditorStore().edit(uncategorized)

    await vi.waitFor(() => {
      expect(focusedTestId()).toBe('operation-category')
    })
  })

  it('focuses the replacement once a used category is checked', async () => {
    installFakeApi(fetchMock, {
      [`GET /categories/${ids.groceries}/usage`]: () => ({
        operations: 4,
        schedules: 0,
        envelopes: 0,
        rules: 0,
      }),
    })
    const wrapper = await mountSuspended(CategoryDeleteModal, {
      props: { open: true, category: categories[0] ?? null, categories },
    })
    mounted.push(wrapper)

    await vi.waitFor(() => {
      expect(focusedTestId()).toBe('category-replacement')
    })
  })
})
