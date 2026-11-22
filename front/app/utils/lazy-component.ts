import { defineAsyncComponent } from 'vue'
import type { AsyncComponentLoader, Component } from 'vue'
import type { LazyComponent } from '~~/types/skeleton'

export function lazyComponent(
  loader: AsyncComponentLoader,
  loadingComponent: Component,
): LazyComponent {
  let request: ReturnType<AsyncComponentLoader> | null = null

  function load(): ReturnType<AsyncComponentLoader> {
    if (request === null) {
      const pending = loader()
      request = pending
      void pending.catch(() => {
        if (request === pending) {
          request = null
        }
      })
    }
    return request
  }

  return {
    component: defineAsyncComponent({
      loader: load,
      loadingComponent,
      delay: 0,
      suspensible: false,
    }),
    load,
  }
}
