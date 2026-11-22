import { defineAsyncComponent } from 'vue'
import type { AsyncComponentLoader, Component } from 'vue'
import type { LazyComponent } from '~~/types/skeleton'

export function lazyComponent<T extends Component>(
  loader: AsyncComponentLoader<T>,
  loadingComponent: Component,
): LazyComponent<T> {
  let request: ReturnType<AsyncComponentLoader<T>> | null = null

  function load(): ReturnType<AsyncComponentLoader<T>> {
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
    component: defineAsyncComponent<T>({
      loader: load,
      loadingComponent,
      delay: 0,
      suspensible: false,
    }),
    load,
  }
}
