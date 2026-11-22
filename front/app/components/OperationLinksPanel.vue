<script setup lang="ts">
import {
  operationSchema,
  transferSchema,
} from '@mint/shared/schemas/operations'
import { candidateListResponseSchema } from '@mint/shared/schemas/reconciliation'
import type { ImportCandidate } from '@mint/shared/types/imports'
import type { SelectItem } from '~~/types/forms'
import type { OperationLinksPanelProps } from '~~/types/planning'

const props = defineProps<OperationLinksPanelProps>()

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()
const editor = useOperationEditorStore()

const candidates = ref<ImportCandidate[]>([])
const counterpartId = ref<string | undefined>(undefined)
const busy = ref(false)

const canReconcile = computed(
  () => props.operation.origin !== 'schedule' && !props.operation.reconciled,
)

async function loadCandidates(): Promise<void> {
  if (!canReconcile.value) {
    candidates.value = []
    return
  }
  try {
    candidates.value = (
      await apiGet(
        `/operations/${props.operation.id}/candidates`,
        candidateListResponseSchema,
      )
    ).candidates
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  }
}

watch(() => props.operation.id, loadCandidates, { immediate: true })

async function run(action: () => Promise<unknown>, done: string) {
  busy.value = true
  try {
    await action()
    toast.add({ title: done, icon: icons.success, color: 'success' })
    editor.markSaved()
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    busy.value = false
  }
}

function associate(candidate: ImportCandidate): Promise<void> {
  return run(
    () =>
      apiCall(
        'POST',
        `/operations/${props.operation.id}/reconcile`,
        operationSchema,
        {
          scheduleId: candidate.scheduleId,
          originalDate: candidate.originalDate,
        },
      ),
    t('reconciliation.associated'),
  )
}

function dissociate(): Promise<void> {
  return run(
    () =>
      apiCall(
        'DELETE',
        `/operations/${props.operation.id}/reconcile`,
        operationSchema,
      ),
    t('reconciliation.dissociated'),
  )
}

const counterpartItems = computed<SelectItem<string>[]>(() =>
  referentials.activeAccounts
    .filter((account) => account.id !== props.operation.accountId)
    .map((account) => ({ label: account.name, value: account.id })),
)

function convert(): Promise<void> {
  const counterpartAccountId = counterpartId.value
  if (counterpartAccountId === undefined) {
    return Promise.resolve()
  }
  return run(
    () =>
      apiCall(
        'POST',
        `/operations/${props.operation.id}/convert-to-transfer`,
        transferSchema,
        { counterpartAccountId },
      ),
    t('reconciliation.converted'),
  )
}

async function createRule(): Promise<void> {
  editor.isOpen = false
  await navigateTo({ path: '/rules', query: { operation: props.operation.id } })
}
</script>

<template>
  <section
    class="flex flex-col gap-3 rounded-md border border-default p-3"
    data-testid="operation-links"
  >
    <p v-if="operation.bankLabel !== null" class="text-sm text-muted">
      {{ t('reconciliation.bankLabel') }}
      <span class="font-medium text-default">{{ operation.bankLabel }}</span>
    </p>
    <div v-if="operation.reconciled" class="flex flex-wrap items-center gap-2">
      <UIcon :name="icons.reconciled" class="size-4 text-muted" />
      <span class="text-sm text-default">
        {{
          t('reconciliation.reconciledWith', {
            date: formatDate(operation.occurrenceDate ?? operation.date),
          })
        }}
      </span>
      <OfflineGuard v-slot="{ offline }">
        <UButton
          :disabled="offline"
          :label="t('reconciliation.dissociate')"
          color="neutral"
          variant="outline"
          size="sm"
          :loading="busy"
          data-testid="operation-dissociate"
          @click="dissociate"
        />
      </OfflineGuard>
    </div>
    <div v-else-if="candidates.length > 0" class="flex flex-col gap-1">
      <p class="text-sm font-medium text-muted">
        {{ t('reconciliation.candidates') }}
      </p>
      <ul class="flex flex-col divide-y divide-default">
        <ListRow
          v-for="candidate in candidates"
          :key="`${candidate.scheduleId}-${candidate.originalDate}`"
          :padding="1"
        >
          <span class="min-w-0 flex-1 truncate text-sm text-default">
            {{ candidate.scheduleLabel }}
            <span class="text-xs text-muted">
              · {{ formatDate(candidate.effectiveDate) }}
            </span>
          </span>
          <MoneyAmount :cents="candidate.amountCents" variant="flow" />
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              :label="t('reconciliation.associate')"
              color="primary"
              variant="soft"
              size="sm"
              :loading="busy"
              :data-testid="`operation-associate-${candidate.scheduleId}`"
              @click="associate(candidate)"
            />
          </OfflineGuard>
        </ListRow>
      </ul>
    </div>
    <div
      v-if="canReconcile && operation.origin !== 'schedule'"
      class="flex flex-wrap items-end gap-2"
    >
      <AppFormField
        :label="t('reconciliation.convertTo')"
        name="counterpartAccountId"
        class="min-w-48 flex-1"
      >
        <USelect
          v-model="counterpartId"
          :items="counterpartItems"
          class="w-full"
          data-testid="operation-counterpart"
        />
      </AppFormField>
      <OfflineGuard v-slot="{ offline }">
        <UButton
          :label="t('reconciliation.convert')"
          :icon="icons.transfer"
          color="neutral"
          variant="outline"
          :disabled="offline || counterpartId === undefined"
          :loading="busy"
          data-testid="operation-convert"
          @click="convert"
        />
      </OfflineGuard>
    </div>
    <OfflineGuard v-if="operation.bankLabel !== null" v-slot="{ offline }">
      <UButton
        :disabled="offline"
        :label="t('reconciliation.createRule')"
        :icon="icons.rules"
        color="neutral"
        variant="ghost"
        class="self-start"
        data-testid="operation-create-rule"
        @click="createRule"
      />
    </OfflineGuard>
  </section>
</template>
