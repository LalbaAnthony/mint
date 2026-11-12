import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'

const ToasterProbe = defineComponent({
  setup() {
    return { position: useToasterPosition() }
  },
  render: () => h('div'),
})

const initialWidth = window.innerWidth

function setViewportWidth(width: number) {
  const happyDOM: unknown = Reflect.get(window, 'happyDOM')
  if (
    typeof happyDOM !== 'object' ||
    happyDOM === null ||
    !('setViewport' in happyDOM) ||
    typeof happyDOM.setViewport !== 'function'
  ) {
    throw new Error('The front tests require the happy-dom environment')
  }
  happyDOM.setViewport({ width })
}

afterEach(() => {
  setViewportWidth(initialWidth)
})

describe('useToasterPosition (CHG-58)', () => {
  it('places toasts at the bottom right from 1024 px', async () => {
    setViewportWidth(1024)

    const wrapper = await mountSuspended(ToasterProbe)

    expect(wrapper.vm.position).toBe('bottom-right')
  })

  it('places toasts at the top center below 1024 px', async () => {
    setViewportWidth(1023)

    const wrapper = await mountSuspended(ToasterProbe)

    expect(wrapper.vm.position).toBe('top-center')
  })
})
