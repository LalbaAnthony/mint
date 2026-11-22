import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, reactive } from 'vue'
import type { Component, VNode } from 'vue'
import { UModal } from '#components'
import AppForm from '~/components/AppForm.vue'
import TagSelect from '~/components/TagSelect.vue'
import { findInBody, setViewportSize } from '../planning-fixtures'

const layoutHeight = 800
const keyboardHeight = 350
const fieldHeight = 40

class FakeVisualViewport extends EventTarget {
  offsetTop = 0
  height = layoutHeight
  scale = 1

  resize(height: number, scale = 1): void {
    this.height = height
    this.scale = scale
    this.dispatchEvent(new Event('resize'))
  }
}

const viewport = new FakeVisualViewport()
const mounted: { unmount: () => void }[] = []

async function mountAttached(component: Component) {
  const wrapper = await mountSuspended(component, { attachTo: document.body })
  mounted.push(wrapper)
  await nextTick()
  return wrapper
}

function afterFrames(count = 3): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count
    const step = () => {
      remaining -= 1
      if (remaining === 0) {
        resolve()
        return
      }
      requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}

function mountForm(children: () => VNode[], outside: () => VNode[] = () => []) {
  return mountAttached(
    defineComponent({
      setup: () => {
        useVisibleViewport()
        useKeyboardCentering()
        const state = reactive({ label: '' })
        return () =>
          h('div', [
            h(
              'div',
              {
                'data-testid': 'container',
                style: 'overflow-y: auto; padding-bottom: 16px',
              },
              [h(AppForm, { state }, children)],
            ),
            ...outside(),
          ])
      },
    }),
  )
}

function element(testId: string): HTMLElement {
  const found = findInBody(`[data-testid="${testId}"]`)
  if (found === null) {
    throw new Error(`Missing element ${testId}`)
  }
  return found
}

function layOut(
  container: HTMLElement,
  options: { contentHeight: number; maxHeight?: number },
) {
  let scrollTop = 0
  const padding = () => Number.parseFloat(container.style.paddingBottom) || 0
  const clientHeight = () =>
    options.maxHeight === undefined
      ? layoutHeight
      : Math.min(options.maxHeight, options.contentHeight + padding())
  const scrollHeight = () =>
    Math.max(clientHeight(), options.contentHeight + padding())
  Object.defineProperty(container, 'clientHeight', {
    configurable: true,
    get: clientHeight,
  })
  Object.defineProperty(container, 'scrollHeight', {
    configurable: true,
    get: scrollHeight,
  })
  Object.defineProperty(container, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (value: number) => {
      scrollTop = Math.min(Math.max(0, value), scrollHeight() - clientHeight())
    },
  })
  vi.spyOn(container, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, 0, 390, clientHeight()),
  )
}

function place(field: HTMLElement, container: HTMLElement, top: number) {
  vi.spyOn(field, 'getBoundingClientRect').mockImplementation(
    () => new DOMRect(0, top - container.scrollTop, 300, fieldHeight),
  )
}

function fieldCenter(field: HTMLElement): number {
  const rect = field.getBoundingClientRect()
  return (rect.top + rect.bottom) / 2
}

function openKeyboard(): void {
  viewport.resize(layoutHeight - keyboardHeight)
}

const visibleCenter = (layoutHeight - keyboardHeight) / 2

beforeEach(() => {
  setViewportSize(390, layoutHeight)
  viewport.offsetTop = 0
  viewport.height = layoutHeight
  viewport.scale = 1
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  })
})

afterEach(() => {
  for (const wrapper of mounted.splice(0)) {
    wrapper.unmount()
  }
  Reflect.deleteProperty(window, 'visualViewport')
  setViewportSize(1024, 768)
  document.body.innerHTML = ''
})

describe('keyboard centering helpers', () => {
  it('detects the fields that open the virtual keyboard', () => {
    const opening = [
      Object.assign(document.createElement('input'), { type: 'text' }),
      Object.assign(document.createElement('input'), { type: 'search' }),
      Object.assign(document.createElement('input'), { type: 'number' }),
      document.createElement('textarea'),
    ]
    for (const field of opening) {
      expect(opensVirtualKeyboard(field)).toBe(true)
    }
    const decimal = document.createElement('input')
    decimal.setAttribute('inputmode', 'decimal')
    expect(opensVirtualKeyboard(decimal)).toBe(true)

    const none = document.createElement('input')
    none.setAttribute('inputmode', 'none')
    const closed = [
      Object.assign(document.createElement('input'), { type: 'date' }),
      Object.assign(document.createElement('input'), { type: 'checkbox' }),
      Object.assign(document.createElement('input'), { readOnly: true }),
      Object.assign(document.createElement('textarea'), { disabled: true }),
      none,
      document.createElement('button'),
      null,
    ]
    for (const field of closed) {
      expect(opensVirtualKeyboard(field)).toBe(false)
    }
  })

  it('reads an open keyboard from the visual viewport, ignoring zoom', () => {
    expect(
      isVirtualKeyboardOpen({ offsetTop: 0, height: 450, scale: 1 }, 800),
    ).toBe(true)
    expect(
      isVirtualKeyboardOpen({ offsetTop: 0, height: 780, scale: 1 }, 800),
    ).toBe(false)
    expect(
      isVirtualKeyboardOpen({ offsetTop: 120, height: 400, scale: 2 }, 800),
    ).toBe(false)
  })

  it('measures the offset between a field and the middle of the visible span', () => {
    const visible = visibleSpan(
      { top: 56, bottom: 800 },
      { offsetTop: 0, height: 450, scale: 1 },
    )
    expect(visible).toEqual({ top: 56, bottom: 450 })
    expect(centeringOffset({ top: 500, bottom: 540 }, visible)).toBe(267)
  })
})

describe('visible viewport properties', () => {
  it('mirrors the visual viewport and falls back to the layout while zoomed', async () => {
    await mountForm(() => [])
    const style = document.documentElement.style
    viewport.offsetTop = 24
    openKeyboard()
    expect(style.getPropertyValue('--app-visible-top')).toBe('24px')
    expect(style.getPropertyValue('--app-visible-height')).toBe('450px')

    viewport.resize(400, 2)
    expect(style.getPropertyValue('--app-visible-top')).toBe('')
    expect(style.getPropertyValue('--app-visible-height')).toBe('')
  })
})

describe('keyboard centering in forms (CHG-69)', () => {
  it('centers a form field above the keyboard once it opens', async () => {
    await mountForm(() => [h('input', { 'data-testid': 'field' })])
    const container = element('container')
    const field = element('field')
    layOut(container, { contentHeight: 1200 })
    place(field, container, 500)

    field.focus()
    await afterFrames()
    expect(container.scrollTop).toBe(0)

    openKeyboard()
    await vi.waitFor(() => {
      expect(fieldCenter(field)).toBe(visibleCenter)
    })
    expect(container.style.paddingBottom).toBe('16px')
  })

  it('centers each field touched while the keyboard stays open', async () => {
    await mountForm(() => [
      h('input', { 'data-testid': 'first' }),
      h('textarea', { 'data-testid': 'second' }),
    ])
    const container = element('container')
    const first = element('first')
    const second = element('second')
    layOut(container, { contentHeight: 1600 })
    place(first, container, 300)
    place(second, container, 700)
    first.focus()
    openKeyboard()
    await vi.waitFor(() => {
      expect(fieldCenter(first)).toBe(visibleCenter)
    })

    second.focus()

    await vi.waitFor(() => {
      expect(fieldCenter(second)).toBe(visibleCenter)
    })
  })

  it('adds just enough bottom space to center a field near the end, until the keyboard closes', async () => {
    await mountForm(() => [h('input', { 'data-testid': 'field' })])
    const container = element('container')
    const field = element('field')
    layOut(container, { contentHeight: 800 })
    place(field, container, 700)
    field.focus()

    openKeyboard()

    await vi.waitFor(() => {
      expect(fieldCenter(field)).toBe(visibleCenter)
    })
    expect(container.style.paddingBottom).toBe('495px')

    viewport.resize(layoutHeight)
    expect(container.style.paddingBottom).toBe('16px')
  })

  it('adds no bottom space when it would make the container grow', async () => {
    await mountForm(() => [h('input', { 'data-testid': 'field' })])
    const container = element('container')
    const field = element('field')
    layOut(container, { contentHeight: 300, maxHeight: 418 })
    place(field, container, 250)
    field.focus()

    openKeyboard()
    await afterFrames()

    expect(container.style.paddingBottom).toBe('16px')
    expect(container.scrollTop).toBe(0)
  })

  it('leaves the fields outside a form where they are', async () => {
    await mountForm(
      () => [],
      () => [h('input', { 'data-testid': 'outside' })],
    )
    const container = element('container')
    const field = element('outside')
    layOut(container, { contentHeight: 1200 })
    place(field, container, 500)
    field.focus()

    openKeyboard()
    await afterFrames()

    expect(container.scrollTop).toBe(0)
  })

  it('centers the search field of a dropdown by scrolling the container of its trigger', async () => {
    await mountForm(
      () => [
        h('button', {
          type: 'button',
          'aria-controls': 'tag-options',
          'aria-expanded': 'true',
        }),
      ],
      () => [
        h('div', [
          h('input', {
            'data-testid': 'search',
            'aria-controls': 'tag-options',
            'aria-expanded': 'true',
          }),
          h('ul', { id: 'tag-options', role: 'listbox' }),
        ]),
      ],
    )
    const container = element('container')
    const search = element('search')
    layOut(container, { contentHeight: 1200 })
    place(search, container, 620)
    search.focus()

    openKeyboard()

    await vi.waitFor(() => {
      expect(fieldCenter(search)).toBe(visibleCenter)
    })
  })

  async function openTagSearch(): Promise<HTMLElement> {
    const tagSearchSelector = '[data-slot="content"] input'
    element('tags').click()
    await vi.waitFor(() => {
      expect(findInBody(tagSearchSelector)).not.toBeNull()
    })
    const search = findInBody(tagSearchSelector)
    if (search === null) {
      throw new Error('Missing tag search field')
    }
    return search
  }

  it('finds the tag selector trigger from its search field', async () => {
    await mountForm(() => [h(TagSelect, { modelValue: [], testId: 'tags' })])

    const search = await openTagSearch()

    expect(popoverAnchor(search)).toBe(element('tags'))
  })

  it('finds no trigger for a field outside the open tag selector', async () => {
    await mountForm(() => [
      h(TagSelect, { modelValue: [], testId: 'tags' }),
      h('input', { 'data-testid': 'field' }),
    ])

    await openTagSearch()

    expect(popoverAnchor(element('field'))).toBeNull()
  })
})

describe('modals in the visible viewport', () => {
  function mountModal(fullscreen: boolean) {
    return mountAttached(
      defineComponent({
        setup: () => () =>
          h(
            UModal,
            { open: true, fullscreen, title: 'Modale' },
            { body: () => 'Contenu' },
          ),
      }),
    )
  }

  function contentClasses(): string[] {
    return (findInBody('[data-slot="content"]')?.className ?? '').split(' ')
  }

  it('sizes a fullscreen modal to the visible viewport', async () => {
    await mountModal(true)

    await vi.waitFor(() => {
      expect(contentClasses()).toEqual(
        expect.arrayContaining([
          'bottom-auto',
          'top-(--app-visible-top)',
          'h-(--app-visible-height)',
        ]),
      )
    })
  })

  it('centers a modal in the visible viewport and caps it to its height', async () => {
    await mountModal(false)

    await vi.waitFor(() => {
      expect(contentClasses()).toEqual(
        expect.arrayContaining([
          'top-[calc(var(--app-visible-top)_+_var(--app-visible-height)_/_2)]',
          'max-h-[calc(var(--app-visible-height)_-_2rem)]',
          'sm:max-h-[calc(var(--app-visible-height)_-_4rem)]',
        ]),
      )
    })
    expect(contentClasses()).not.toContain('top-1/2')
    expect(contentClasses()).not.toContain('max-h-[calc(100dvh-2rem)]')
  })
})
