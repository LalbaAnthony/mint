<script setup lang="ts">
import { operationSchema } from '@mint/shared/schemas/operations'
import { candidateListResponseSchema } from '@mint/shared/schemas/reconciliation'
import type { ImportCandidate } from '@mint/shared/types/imports'

const editor = useOperationEditorStore()
const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()

const candidates = ref<ImportCandidate[]>([])
const candidatesState = useLoadState({
  onError: (error) =>
    toast.add({
      title: errorMessage(error),
      icon: icons.error,
      color: 'error',
    }),
})
const selected = ref<string | undefined>(undefined)
const busy = ref(false)

function keyOf(candidate: ImportCandidate): string {
  return `${candidate.scheduleId}|${candidate.originalDate}`
}

watch(
  () => editor.proposal?.id,
  async (id) => {
    candidates.value = []
    selected.value = undefined
    if (id === undefined) {
      return
    }
    await candidatesState.run(async () => {
      candidates.value = (
        await apiGet(
          `/operations/${id}/candidates`,
          candidateListResponseSchema,
        )
      ).candidates
      const [best] = candidates.value
      selected.value = best === undefined ? undefined : keyOf(best)
    })
  },
)

const items = computed(() =>
  candidates.value.map((candidate) => ({
    value: keyOf(candidate),
    label: `${candidate.scheduleLabel} · ${formatDate(candidate.effectiveDate)}`,
  })),
)

async function confirm(): Promise<void> {
  const operation = editor.proposal
  const candidate = candidates.value.find(
    (item) => keyOf(item) === selected.value,
  )
  if (operation === null || candidate === undefined) {
    return
  }
  busy.value = true
  try {
    await apiCall(
      'POST',
      `/operations/${operation.id}/reconcile`,
      operationSchema,
      {
        scheduleId: candidate.scheduleId,
        originalDate: candidate.originalDate,
      },
    )
    toast.add({
      title: t('reconciliation.associated'),
      icon: icons.success,
      color: 'success',
    })
    editor.proposalOpen = false
    editor.markSaved()
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    busy.value = false
  }
}

const connectivity = useConnectivityStore()
const actions = useTemplateRef<HTMLElement>('actions')

useDialogSubmitShortcut(
  actions,
  () => {
    void confirm()
  },
  () =>
    editor.proposalOpen &&
    !connectivity.offline &&
    selected.value !== undefined &&
    !busy.value,
)
</script>

<template>
  <UModal
    v-model:open="editor.proposalOpen"
    :title="t('reconciliation.proposalTitle')"
    :description="
      t('reconciliation.proposalHelp', { label: editor.proposal?.label ?? '' })
    "
  >
    <template #body>
      <div
        ref="actions"
        class="flex flex-col gap-4"
        data-testid="reconciliation-proposal"
      >
        <LoadZone :state="candidatesState">
          <template #skeleton>
            <div class="flex flex-col gap-1">
              <SkeletonText width="md" class="text-sm" />
              <SkeletonList :row="{ padding: 1 }">
                <template #default="{ index }">
                  <SkeletonCircle :size="16" />
                  <SkeletonText
                    :width="skeletonRowWidth(index)"
                    class="text-sm"
                  />
                </template>
              </SkeletonList>
            </div>
          </template>
          <URadioGroup
            v-model="selected"
            :items="items"
            :legend="t('reconciliation.candidates')"
          />
        </LoadZone>
        <div class="flex justify-end gap-2">
          <UButton
            :label="t('reconciliation.ignore')"
            color="neutral"
            variant="outline"
            @click="editor.proposalOpen = false"
          />
          <OfflineGuard v-slot="{ offline }">
            <ShortcutTooltip shortcut="submit">
              <UButton
                :label="t('reconciliation.associate')"
                color="primary"
                variant="solid"
                :loading="busy"
                :disabled="offline || selected === undefined"
                data-testid="reconciliation-confirm"
                @click="confirm"
              />
            </ShortcutTooltip>
          </OfflineGuard>
        </div>
      </div>
    </template>
  </UModal>
</template>
