import type { Operation } from '@mint/shared/types/operations'
import type { QuickAddKind } from '~~/types/navigation'
import type { OperationEditorRequest } from '~~/types/planning'

export const useOperationEditorStore = defineStore('operationEditor', () => {
  const request = ref<OperationEditorRequest | null>(null)
  const proposal = ref<Operation | null>(null)
  const savedVersion = ref(0)

  const isOpen = computed({
    get: () => request.value !== null,
    set: (open: boolean) => {
      if (!open) {
        request.value = null
      }
    },
  })

  const proposalOpen = computed({
    get: () => proposal.value !== null,
    set: (open: boolean) => {
      if (!open) {
        proposal.value = null
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

  function propose(operation: Operation): void {
    proposal.value = operation
  }

  return {
    request,
    isOpen,
    proposal,
    proposalOpen,
    savedVersion,
    create,
    edit,
    markSaved,
    propose,
  }
})
