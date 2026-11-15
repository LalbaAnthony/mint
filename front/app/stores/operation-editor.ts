import type { Operation } from '@mint/shared/types/operations'
import type { QuickAddKind } from '~~/types/navigation'
import type { OperationEditorRequest } from '~~/types/planning'

export const useOperationEditorStore = defineStore('operationEditor', () => {
  const request = ref<OperationEditorRequest | null>(null)
  const savedVersion = ref(0)

  const isOpen = computed({
    get: () => request.value !== null,
    set: (open: boolean) => {
      if (!open) {
        request.value = null
      }
    },
  })

  function create(kind: QuickAddKind): void {
    request.value = { mode: 'create', kind }
  }

  function edit(operation: Operation): void {
    request.value = { mode: 'edit', operation }
  }

  function markSaved(): void {
    savedVersion.value += 1
    request.value = null
  }

  return { request, isOpen, savedVersion, create, edit, markSaved }
})
