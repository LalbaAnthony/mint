import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import LoadZone from '~/components/LoadZone.vue'
import { useLoadState } from '~/composables/useLoadState'
import type { LoadState, LoadStateOptions } from '~~/types/skeleton'
import { mountInApp } from '../app'

function deferred() {
  let resolve: () => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<void>((onResolve, onReject) => {
    resolve = onResolve
    reject = onReject
  })
  return { promise, resolve, reject }
}

const scopes: { stop: () => void }[] = []

function createState(options: LoadStateOptions = {}): LoadState {
  const scope = effectScope()
  scopes.push(scope)
  const state = scope.run(() => useLoadState(options))
  if (state === undefined) {
    throw new Error('scope did not run')
  }
  return state
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  for (const scope of scopes.splice(0)) {
    scope.stop()
  }
  vi.useRealTimers()
})

describe('useLoadState (CHG-48)', () => {
  it('starts pending and shows nothing before the first answer', () => {
    const state = createState()

    expect(state.phase).toBe('pending')
    expect(state.settled).toBe(false)
  })

  it('goes straight to ready when the answer comes within 150 ms', async () => {
    const state = createState()
    const answer = deferred()

    const running = state.run(() => answer.promise)
    await vi.advanceTimersByTimeAsync(149)
    expect(state.phase).toBe('pending')
    answer.resolve()
    await running

    expect(state.phase).toBe('ready')
    expect(state.loading).toBe(false)
    expect(state.settled).toBe(true)
  })

  it('shows the skeleton after 150 ms and keeps it at least 300 ms', async () => {
    const state = createState()
    const answer = deferred()

    const running = state.run(() => answer.promise)
    await vi.advanceTimersByTimeAsync(150)
    expect(state.phase).toBe('skeleton')

    answer.resolve()
    await vi.advanceTimersByTimeAsync(299)
    expect(state.phase).toBe('skeleton')

    await vi.advanceTimersByTimeAsync(1)
    await running
    expect(state.phase).toBe('ready')
  })

  it('does not hold the skeleton longer when the answer is slow', async () => {
    const state = createState()
    const answer = deferred()

    const running = state.run(() => answer.promise)
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.phase).toBe('skeleton')
    answer.resolve()
    await running

    expect(state.phase).toBe('ready')
  })

  it('keeps the previous content before 150 ms on a context change', async () => {
    const state = createState()
    await state.run(() => Promise.resolve())
    const answer = deferred()

    const running = state.run(() => answer.promise)
    await vi.advanceTimersByTimeAsync(100)
    expect(state.phase).toBe('ready')
    expect(state.loading).toBe(true)
    await vi.advanceTimersByTimeAsync(50)
    expect(state.phase).toBe('skeleton')
    answer.resolve()
    await vi.advanceTimersByTimeAsync(300)
    await running

    expect(state.phase).toBe('ready')
  })

  it('never shows the skeleton for a background refresh', async () => {
    const state = createState()
    await state.run(() => Promise.resolve())
    const answer = deferred()

    const running = state.run(() => answer.promise, 'background')
    await vi.advanceTimersByTimeAsync(1000)
    expect(state.phase).toBe('ready')
    answer.resolve()
    await running

    expect(state.phase).toBe('ready')
  })

  it('reports a failed context load as an error (CHG-49)', async () => {
    const onError = vi.fn()
    const state = createState({ onError })
    const failure = new Error('down')

    await state.run(() => Promise.reject(failure))

    expect(state.phase).toBe('error')
    expect(onError).toHaveBeenCalledWith(failure)
  })

  it('shows the error after a failed context change', async () => {
    const state = createState({ onError: vi.fn() })
    await state.run(() => Promise.resolve())

    await state.run(() => Promise.reject(new Error('down')))

    expect(state.phase).toBe('error')
  })

  it('keeps the content when a background refresh fails', async () => {
    const onError = vi.fn()
    const state = createState({ onError })
    await state.run(() => Promise.resolve())

    await state.run(() => Promise.reject(new Error('down')), 'background')

    expect(state.phase).toBe('ready')
    expect(onError).toHaveBeenCalledTimes(1)
  })

  it('shows the error when a background refresh fails before any content', async () => {
    const state = createState({ onError: vi.fn() })

    await state.run(() => Promise.reject(new Error('down')), 'background')

    expect(state.phase).toBe('error')
  })

  it('ignores an answer overtaken by a more recent call', async () => {
    const state = createState({ onError: vi.fn() })
    const first = deferred()
    const second = deferred()

    const firstRun = state.run(() => first.promise)
    const secondRun = state.run(() => second.promise)
    second.resolve()
    await secondRun
    expect(state.phase).toBe('ready')
    first.reject(new Error('late'))
    await firstRun

    expect(state.phase).toBe('ready')
  })

  it('retries the last loader as a context change', async () => {
    const state = createState({ onError: vi.fn() })
    const loader = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(undefined)

    await state.run(loader)
    expect(state.phase).toBe('error')
    await state.retry()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(state.phase).toBe('ready')
  })

  it('stops its timers when its scope is disposed', async () => {
    const scope = effectScope()
    const state = scope.run(() => useLoadState())
    const answer = deferred()

    void state?.run(() => answer.promise)
    scope.stop()
    await vi.advanceTimersByTimeAsync(500)

    expect(state?.phase).toBe('pending')
  })
})

describe('LoadZone (CHG-47, CHG-49)', () => {
  function mountZone(state: LoadState, errorSlot = false) {
    return mountInApp(
      defineComponent({
        setup: () => () =>
          h(
            LoadZone,
            { state, class: 'flex gap-4' },
            {
              skeleton: () => h('p', { 'data-testid': 'zone-skeleton' }),
              default: () => h('p', { 'data-testid': 'zone-content' }),
              ...(errorSlot
                ? { error: () => h('p', { 'data-testid': 'zone-error' }) }
                : {}),
            },
          ),
      }),
    )
  }

  it('reserves the skeleton space without showing it while pending', async () => {
    const wrapper = await mountZone(createState())

    expect(wrapper.get('[data-testid="skeleton-zone"]').classes()).toContain(
      'invisible',
    )
    expect(wrapper.find('[data-testid="zone-content"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(false)
  })

  it('renders the skeleton in a single status region', async () => {
    const state = createState()
    void state.run(() => new Promise(() => undefined))
    await vi.advanceTimersByTimeAsync(150)

    const wrapper = await mountZone(state)
    const zone = wrapper.get('[data-testid="skeleton-zone"]')

    expect(zone.attributes('role')).toBe('status')
    expect(zone.attributes('aria-busy')).toBe('true')
    expect(zone.classes()).not.toContain('invisible')
    expect(zone.classes()).toEqual(expect.arrayContaining(['flex', 'gap-4']))
    expect(zone.get('.sr-only').text()).toBe('Chargement...')
    expect(
      zone
        .get('[aria-hidden="true"]')
        .find('[data-testid="zone-skeleton"]')
        .exists(),
    ).toBe(true)
  })

  it('renders the content once ready', async () => {
    const state = createState()
    await state.run(() => Promise.resolve())

    const wrapper = await mountZone(state)

    expect(wrapper.find('[data-testid="zone-content"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="skeleton-zone"]').exists()).toBe(false)
  })

  it('renders the error state with a retry button', async () => {
    const state = createState({ onError: vi.fn() })
    const loader = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce(undefined)
    await state.run(loader)

    const wrapper = await mountZone(state)
    expect(wrapper.get('[data-testid="load-error"]').text()).toContain(
      'Chargement impossible',
    )
    await wrapper.get('[data-testid="load-error-retry"]').trigger('click')
    await flushPromises()

    expect(loader).toHaveBeenCalledTimes(2)
    expect(wrapper.find('[data-testid="zone-content"]').exists()).toBe(true)
  })

  it('lets a secondary zone leave the error state to another zone', async () => {
    const state = createState({ onError: vi.fn() })
    await state.run(() => Promise.reject(new Error('down')))

    const wrapper = await mountInApp(
      defineComponent({
        setup: () => () =>
          h(
            LoadZone,
            { state, errorState: false },
            { default: () => h('p', { 'data-testid': 'zone-content' }) },
          ),
      }),
    )

    expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="zone-content"]').exists()).toBe(false)
  })

  it('lets a zone replace the error state', async () => {
    const state = createState({ onError: vi.fn() })
    await state.run(() => Promise.reject(new Error('down')))

    const wrapper = await mountZone(state, true)

    expect(wrapper.find('[data-testid="zone-error"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="load-error"]').exists()).toBe(false)
  })
})
