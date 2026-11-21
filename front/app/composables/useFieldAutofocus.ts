import type { InjectionKey } from 'vue'
import type {
  AutofocusField,
  FieldAutofocusOptions,
  FieldAutofocusScope,
} from '~~/types/forms'

const fieldAutofocusKey: InjectionKey<FieldAutofocusScope> =
  Symbol('field-autofocus')

export function provideFieldAutofocus(options: FieldAutofocusOptions): void {
  const fields = new Set<AutofocusField>()
  let settled = false
  let scheduled = false

  function isPending(): boolean {
    return options.pending?.() ?? false
  }

  function attempt(): void {
    scheduled = false
    if (settled || fields.size === 0 || isPending()) {
      return
    }
    settled = true
    firstEmptyFieldControl(options.values(), [...fields])?.focus()
  }

  function schedule(): void {
    if (settled || scheduled) {
      return
    }
    scheduled = true
    nextTick(attempt)
  }

  provide(fieldAutofocusKey, {
    register(field) {
      if (fields.size === 0) {
        settled = false
      }
      fields.add(field)
      schedule()
      return () => {
        fields.delete(field)
      }
    },
  })

  watch(isPending, (pending) => {
    if (!pending) {
      schedule()
    }
  })
}

export function useAutofocusField(field: AutofocusField): void {
  const scope = inject(fieldAutofocusKey, null)
  if (scope === null) {
    return
  }
  let unregister: (() => void) | null = null
  onMounted(() => {
    unregister = scope.register(field)
  })
  onBeforeUnmount(() => {
    unregister?.()
  })
}
