<script setup lang="ts">
import {
  importBatchSchema,
  importBatchViewSchema,
  importFileMaxBytes,
  importHistorySchema,
} from '@mint/shared/schemas/imports'
import type {
  CsvMapping,
  ImportBatch,
  ImportBatchView,
} from '@mint/shared/types/imports'
import type { SelectItem } from '~~/types/forms'
import type { ImportStep, RowDecisionState } from '~~/types/imports'

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const referentials = useReferentialsStore()
const route = useRoute()
const router = useRouter()

const step = ref<ImportStep>('select')
const accountId = ref<string | undefined>(undefined)
const file = ref<File | null>(null)
const view = ref<ImportBatchView | null>(null)
const mapping = ref<CsvMapping | null>(null)
const history = ref<ImportBatch[]>([])
const busy = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const accountItems = computed<SelectItem<string>[]>(() =>
  referentials.activeAccounts.map((account) => ({
    label: account.name,
    value: account.id,
  })),
)

async function loadHistory(): Promise<void> {
  if (accountId.value === undefined) {
    history.value = []
    return
  }
  try {
    history.value = (
      await apiGet(`/accounts/${accountId.value}/imports`, importHistorySchema)
    ).batches
  } catch (error) {
    notifyFailure(error)
  }
}

watch(accountId, loadHistory)

async function openBatch(batchId: string): Promise<void> {
  try {
    const opened = await apiGet(`/imports/${batchId}`, importBatchViewSchema)
    view.value = opened
    mapping.value = opened.mapping
    accountId.value = opened.batch.accountId
    step.value =
      opened.batch.status !== 'pending'
        ? 'select'
        : opened.rows.length > 0
          ? 'review'
          : 'configure'
  } catch (error) {
    notifyFailure(error)
  }
}

onMounted(async () => {
  try {
    await referentials.load()
  } catch (error) {
    notifyFailure(error)
  }
  const batchId = route.query.batch
  if (typeof batchId === 'string') {
    await openBatch(batchId)
    await router.replace({ query: {} })
  } else if (referentials.activeAccounts.length === 1) {
    accountId.value = referentials.activeAccounts[0]?.id
  }
})

function onFileChange(event: Event): void {
  const input = event.target
  file.value =
    input instanceof HTMLInputElement ? (input.files?.[0] ?? null) : null
}

const fileTooLarge = computed(
  () => file.value !== null && file.value.size > importFileMaxBytes,
)

async function preview(next: CsvMapping): Promise<void> {
  const current = view.value
  if (current === null) {
    return
  }
  busy.value = true
  try {
    const previewed = await apiCall(
      'POST',
      `/imports/${current.batch.id}/preview`,
      importBatchViewSchema,
      { mapping: next },
    )
    view.value = previewed
    mapping.value = next
    step.value = 'review'
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

async function upload(): Promise<void> {
  const chosen = file.value
  if (accountId.value === undefined || chosen === null || fileTooLarge.value) {
    return
  }
  busy.value = true
  try {
    const created = await apiUpload(
      `/accounts/${accountId.value}/imports?filename=${encodeURIComponent(chosen.name)}`,
      chosen,
      importBatchViewSchema,
    )
    view.value = created
    mapping.value = created.mapping
    step.value = 'configure'
    await loadHistory()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
  if (view.value?.mappingRemembered === true) {
    await preview(view.value.mapping)
  }
}

function decisionPayload(decisions: Map<number, RowDecisionState>) {
  return [...decisions.entries()].map(([rowIndex, decision]) => {
    const [scheduleId, originalDate] =
      decision.reconcileKey === null ? [] : decision.reconcileKey.split('|')
    return {
      rowIndex,
      include: decision.include,
      categoryId: decision.reconcileKey === null ? decision.categoryId : null,
      transferAccountId:
        decision.reconcileKey === null ? decision.transferAccountId : null,
      reconcile:
        scheduleId === undefined || originalDate === undefined
          ? null
          : { scheduleId, originalDate },
    }
  })
}

async function validate(
  decisions: Map<number, RowDecisionState>,
): Promise<void> {
  const current = view.value
  if (current === null || mapping.value === null) {
    return
  }
  busy.value = true
  try {
    const validated = await apiCall(
      'POST',
      `/imports/${current.batch.id}/validate`,
      importBatchSchema,
      { mapping: mapping.value, decisions: decisionPayload(decisions) },
    )
    toast.add({
      title: t('imports.validated', {
        created: validated.rowsCreated,
        merged: validated.rowsMerged,
      }),
      icon: icons.success,
      color: 'success',
    })
    view.value = null
    file.value = null
    step.value = 'select'
    await loadHistory()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

const batchToCancel = ref<ImportBatch | null>(null)
const cancelOpen = computed({
  get: () => batchToCancel.value !== null,
  set: (open) => {
    if (!open) {
      batchToCancel.value = null
    }
  },
})

async function cancelBatch(): Promise<void> {
  const batch = batchToCancel.value
  if (batch === null) {
    return
  }
  busy.value = true
  try {
    await apiCall('POST', `/imports/${batch.id}/cancel`, importBatchSchema)
    batchToCancel.value = null
    await loadHistory()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

async function abandon(batch: ImportBatch): Promise<void> {
  busy.value = true
  try {
    await apiCommand('DELETE', `/imports/${batch.id}`)
    if (view.value?.batch.id === batch.id) {
      view.value = null
      step.value = 'select'
    }
    await loadHistory()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ViewPanel :title="t('navigation.import')">
    <div class="flex flex-col gap-4">
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t(`imports.steps.${step}`) }}
          </h2>
        </template>
        <div
          v-if="step === 'select'"
          class="flex flex-wrap items-end gap-3"
          data-testid="import-select"
        >
          <AppFormField
            :label="t('operations.fields.account')"
            name="accountId"
            class="min-w-48 flex-1"
          >
            <USelect
              v-model="accountId"
              :items="accountItems"
              class="w-full"
              data-testid="import-account"
            />
          </AppFormField>
          <AppFormField
            :label="t('imports.file')"
            :hint="t('imports.fileHint')"
            name="file"
            class="min-w-48 flex-1"
          >
            <UInput
              type="file"
              accept=".csv,text/csv,text/plain"
              class="w-full"
              data-testid="import-file"
              @change="onFileChange"
            />
          </AppFormField>
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :label="t('imports.upload')"
              :icon="icons.import"
              color="primary"
              variant="soft"
              :disabled="
                offline ||
                accountId === undefined ||
                file === null ||
                fileTooLarge
              "
              :loading="busy"
              data-testid="import-upload"
              @click="upload"
            />
          </OfflineGuard>
          <p v-if="fileTooLarge" class="w-full text-sm text-error">
            {{ t('imports.tooLarge') }}
          </p>
        </div>
        <ImportMappingForm
          v-else-if="step === 'configure' && view !== null"
          :view="view"
          :busy="busy"
          @preview="preview"
        />
        <ImportReview
          v-else-if="
            step === 'review' && view !== null && accountId !== undefined
          "
          :key="view.batch.id + view.rows.length"
          :rows="view.rows"
          :account-id="accountId"
          :busy="busy"
          @validate="validate"
          @back="step = 'configure'"
        />
      </UCard>
      <UCard v-if="accountId !== undefined">
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t('imports.history') }}
          </h2>
        </template>
        <ImportHistory
          :batches="history"
          :busy="busy"
          @resume="(batch) => openBatch(batch.id)"
          @cancel="(batch) => (batchToCancel = batch)"
          @abandon="abandon"
        />
      </UCard>
    </div>
    <ConfirmModal
      v-model:open="cancelOpen"
      :title="t('imports.cancelTitle')"
      :description="t('imports.cancelEffect')"
      :confirm-label="t('imports.cancel')"
      :pending="busy"
      @confirm="cancelBatch"
    />
  </ViewPanel>
</template>
