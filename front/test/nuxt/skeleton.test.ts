import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { flushPromises } from '@vue/test-utils'
import ListRow from '~/components/ListRow.vue'
import StatGrid from '~/components/StatGrid.vue'
import StatTile from '~/components/StatTile.vue'
import SkeletonAmount from '~/components/skeleton/Amount.vue'
import SkeletonBlock from '~/components/skeleton/Block.vue'
import SkeletonCircle from '~/components/skeleton/Circle.vue'
import SkeletonControl from '~/components/skeleton/Control.vue'
import SkeletonList from '~/components/skeleton/List.vue'
import SkeletonText from '~/components/skeleton/Text.vue'
import { skeletonCountsStorageKey } from '~/stores/skeleton-counts'
import { lazyComponent } from '~/utils/lazy-component'
import type { StatTileProps } from '~~/types/skeleton'
import { mountInApp } from '../app'

afterEach(() => {
  useAmountMaskStore().forget()
})

describe('Skeleton primitives (CHG-47)', () => {
  it('draws an elevated bar that pulses only without reduced motion', async () => {
    const wrapper = await mountInApp(SkeletonBlock)
    const block = wrapper.get('[data-skeleton]')

    expect(block.classes()).toEqual(
      expect.arrayContaining([
        'bg-elevated',
        'motion-safe:animate-pulse',
        'rounded-md',
      ]),
    )
    expect(block.classes()).not.toContain('animate-pulse')
    expect(block.attributes('aria-hidden')).toBe('true')
  })

  it('gives each text line the line height of its typography', async () => {
    const wrapper = await mountInApp(SkeletonText, {
      props: { lines: 3, width: 'full', class: 'text-sm' },
    })
    const lines = wrapper.findAll('.h-\\[1lh\\]')

    expect(wrapper.get('[aria-hidden="true"]').classes()).toContain('text-sm')
    expect(lines).toHaveLength(3)
    const bars = wrapper.findAll('[data-skeleton]')
    expect(bars.map((bar) => bar.classes())).toEqual([
      expect.arrayContaining(['w-full', 'h-[0.75em]', 'rounded-sm']),
      expect.arrayContaining(['w-full']),
      expect.arrayContaining(['w-2/3']),
    ])
  })

  it('sizes an amount in ch and follows the masked mode', async () => {
    const wrapper = await mountInApp(SkeletonAmount, {
      props: { concealable: true },
    })
    expect(wrapper.get('[data-skeleton]').classes()).toContain('w-[8ch]')

    useAmountMaskStore().toggle()
    await flushPromises()
    expect(wrapper.get('[data-skeleton]').classes()).toContain('w-[5ch]')
  })

  it('keeps the full width of an amount that cannot be masked', async () => {
    useAmountMaskStore().toggle()
    const wrapper = await mountInApp(SkeletonAmount)

    expect(wrapper.get('[data-skeleton]').classes()).toContain('w-[8ch]')
  })

  it('draws round shapes at the business sizes', async () => {
    const wrapper = await mountInApp(SkeletonCircle, { props: { size: 64 } })

    expect(wrapper.get('[data-skeleton]').classes()).toEqual(
      expect.arrayContaining(['size-16', 'rounded-full']),
    )
  })

  it.each([
    ['field', 'md', ['h-8', 'rounded-md']],
    ['button', 'sm', ['h-7']],
    ['icon-button', 'md', ['size-8']],
    ['touch-icon-button', 'md', ['size-8', 'max-lg:size-11']],
    ['badge', 'sm', ['h-5']],
  ] as const)(
    'draws a %s control at the %s Nuxt UI height',
    async (kind, size, classes) => {
      const wrapper = await mountInApp(SkeletonControl, {
        props: { kind, size },
      })

      expect(wrapper.get('[data-skeleton]').classes()).toEqual(
        expect.arrayContaining([...classes]),
      )
    },
  )

  it('centres a checkbox in its 20 px Nuxt UI container', async () => {
    const wrapper = await mountInApp(SkeletonControl, {
      props: { kind: 'checkbox' },
    })

    expect(wrapper.get('.h-5').get('[data-skeleton]').classes()).toEqual(
      expect.arrayContaining(['size-4', 'rounded-sm']),
    )
  })

  it('repeats three hidden rows by default', async () => {
    const wrapper = await mountInApp(SkeletonList, {
      props: { row: { gap: 3 } },
      slots: { default: () => 'row' },
    })

    expect(wrapper.get('ul').attributes('aria-hidden')).toBe('true')
    const rows = wrapper.findAll('li')
    expect(rows).toHaveLength(3)
    expect(rows[0]?.classes()).toEqual(
      expect.arrayContaining(['flex', 'gap-3', 'py-2', 'items-center']),
    )
  })

  it('renders an ordered list on demand', async () => {
    const wrapper = await mountInApp(SkeletonList, {
      props: { ordered: true, count: 2 },
    })

    expect(wrapper.findAll('ol > li')).toHaveLength(2)
  })
})

describe('ListRow (CHG-47)', () => {
  it('lays out a centred row with the default spacing', async () => {
    const wrapper = await mountInApp(ListRow)

    expect(wrapper.get('li').classes()).toEqual(
      expect.arrayContaining(['flex', 'gap-2', 'py-2', 'items-center']),
    )
  })

  it('reproduces the spacing variants of the lists', async () => {
    const wrapper = await mountInApp(ListRow, {
      props: {
        gap: 3,
        padding: 3,
        flush: true,
        inset: true,
        wrap: true,
        spread: true,
        align: 'start',
      },
    })

    expect(wrapper.get('li').classes()).toEqual(
      expect.arrayContaining([
        'gap-3',
        'py-3',
        'first:pt-0',
        'last:pb-0',
        'px-4',
        'sm:px-6',
        'flex-wrap',
        'justify-between',
        'items-start',
      ]),
    )
  })

  it('stacks a column row without centring its items', async () => {
    const wrapper = await mountInApp(ListRow, {
      props: { direction: 'column', padding: 1.5 },
    })

    const classes = wrapper.get('li').classes()
    expect(classes).toEqual(expect.arrayContaining(['flex-col', 'py-1.5']))
    expect(classes).not.toContain('items-center')
  })

  it('renders a full-width button row', async () => {
    const onClick = vi.fn()
    const wrapper = await mountInApp(ListRow, {
      props: { as: 'button', onClick },
    })
    const button = wrapper.get('button')

    expect(button.attributes('type')).toBe('button')
    expect(button.classes()).toEqual(
      expect.arrayContaining(['w-full', 'text-left']),
    )
    await button.trigger('click')
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('StatGrid and StatTile (CHG-57, CHG-30)', () => {
  it.each([
    [2, ['md:grid-cols-2']],
    [3, ['md:grid-cols-3']],
    [4, ['md:grid-cols-2', 'xl:grid-cols-4']],
  ] as const)('lays out %i indicator columns', async (columns, classes) => {
    const wrapper = await mountInApp(StatGrid, { props: { columns } })

    expect(wrapper.get('div').classes()).toEqual(
      expect.arrayContaining(['grid', 'grid-cols-1', 'gap-4', ...classes]),
    )
  })

  function mountTile(props: StatTileProps) {
    return mountInApp(
      defineComponent({
        setup: () => () =>
          h(StatTile, props, {
            default: ({ valueClass }: { valueClass: string }) =>
              h('span', { class: valueClass, 'data-testid': 'value' }),
          }),
      }),
    )
  }

  it('gives the main indicator a text-3xl bold value and an accent tile', async () => {
    const wrapper = await mountTile({
      label: 'Patrimoine',
      icon: icons.accounts,
      emphasis: 'primary',
    })

    expect(wrapper.get('.bg-accent-tile').classes()).toContain('size-10')
    expect(wrapper.get('p').text()).toBe('Patrimoine')
    expect(wrapper.get('[data-testid="value"]').classes()).toEqual(
      expect.arrayContaining(['text-3xl', 'font-bold']),
    )
  })

  it('gives a secondary indicator a text-xl semibold value', async () => {
    const wrapper = await mountTile({ label: 'Dépenses' })

    expect(wrapper.find('.bg-accent-tile').exists()).toBe(false)
    expect(wrapper.get('[data-testid="value"]').classes()).toEqual(
      expect.arrayContaining(['text-xl', 'font-semibold']),
    )
  })
})

describe('lazyComponent (ADR 0036)', () => {
  const Loaded = defineComponent({
    setup: () => () => h('p', { 'data-testid': 'loaded' }),
  })
  const Loading = defineComponent({
    setup: () => () => h('p', { 'data-testid': 'loading' }),
  })

  it('shares a single request between preload and render', async () => {
    const loader = vi.fn(() => Promise.resolve(Loaded))
    const lazy = lazyComponent(loader, Loading)

    await lazy.load()
    const wrapper = await mountInApp(lazy.component)
    await flushPromises()

    expect(loader).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="loaded"]').exists()).toBe(true)
  })

  it('renders its skeleton while the code is loading', async () => {
    let finish: (component: typeof Loaded) => void = () => undefined
    const lazy = lazyComponent(
      () =>
        new Promise<typeof Loaded>((resolve) => {
          finish = resolve
        }),
      Loading,
    )

    const wrapper = await mountInApp(lazy.component)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
    finish(Loaded)
    await flushPromises()

    expect(wrapper.find('[data-testid="loaded"]').exists()).toBe(true)
  })

  it('forgets a failed request so that a retry loads again', async () => {
    const loader = vi
      .fn<() => Promise<typeof Loaded>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(Loaded)
    const lazy = lazyComponent(loader, Loading)

    await expect(lazy.load()).rejects.toThrow('offline')
    await expect(lazy.load()).resolves.toBe(Loaded)
    expect(loader).toHaveBeenCalledTimes(2)
  })
})

describe('skeleton row counts (CHG-48)', () => {
  afterEach(() => {
    useSkeletonCountsStore().forget()
  })

  it('falls back to three rows, then keeps the last count between 1 and 20', () => {
    const store = useSkeletonCountsStore()

    expect(store.rowsOf('operations', [skeletonRowCount])).toEqual([3])
    store.remember('operations', [7])
    expect(store.rowsOf('operations', [skeletonRowCount])).toEqual([7])
    store.remember('operations', [0])
    expect(store.rowsOf('operations', [skeletonRowCount])).toEqual([1])
    store.remember('operations', [50])
    expect(store.rowsOf('operations', [skeletonRowCount])).toEqual([20])
    store.remember('accounts', [])
    expect(store.rowsOf('accounts', [3, 3])).toEqual([1])
  })

  it('keeps the counts for the tab and forgets them on logout', () => {
    const store = useSkeletonCountsStore()

    store.remember('rules', [4])
    expect(
      JSON.parse(
        window.sessionStorage.getItem(skeletonCountsStorageKey) ?? '{}',
      ),
    ).toEqual({ rules: [4] })
    useSessionStore().clear()

    expect(store.rowsOf('rules', [skeletonRowCount])).toEqual([3])
    expect(window.sessionStorage.getItem(skeletonCountsStorageKey)).toBeNull()
  })
})
