import { mountSuspended } from '@nuxt/test-utils/runtime'
import { defineComponent, h } from 'vue'
import type { Component } from 'vue'
import { UApp } from '#components'
import type { AppMountOptions } from '~~/types/tests'

export function inApp(
  component: Component,
  { props, slots }: Pick<AppMountOptions, 'props' | 'slots'> = {},
): Component {
  return defineComponent({
    setup: () => () =>
      h(UApp, null, { default: () => h(component, props, slots) }),
  })
}

export function mountInApp(
  component: Component,
  { props, slots, ...rootOptions }: AppMountOptions = {},
) {
  return mountSuspended(inApp(component, { props, slots }), rootOptions)
}
