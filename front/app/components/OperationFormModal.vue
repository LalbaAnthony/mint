<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { SelectItem as UiSelectItem } from '@nuxt/ui'
import {
  operationSaveResponseSchema,
  transferSaveResponseSchema,
} from '@mint/shared/schemas/operations'
import type { CapWarning } from '@mint/shared/types/interest'
import { candidateListResponseSchema } from '@mint/shared/schemas/reconciliation'
import type { Operation } from '@mint/shared/types/operations'
import { operationFormSchema, transferFormSchema } from '~~/schemas/forms'
import type { SelectItem } from '~~/types/forms'
import type { QuickAddKind } from '~~/types/navigation'
import type { OperationFormState } from '~~/types/planning'

const noCategory = 'none'

const editor = useOperationEditorStore()
const referentials = useReferentialsStore()
const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const { formatDate, formatMoney } = useFormatters()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const saving = ref(false)

function emptyState(kind: QuickAddKind): OperationFormState {
  return {
    kind,
    source: undefined,
    sourceAccountId: undefined,
    targetAccountId: undefined,
    date: parisDate(new Date()),
    amount: '',
    label: '',
    categoryId: undefined,
    tagIds: [],
    note: '',
  }
}

function stateFrom(operation: Operation): OperationFormState {
  const amount = formatAmountInput(
    Math.abs(operation.amountCents),
    locale.value,
  )
  const common = {
    date: operation.date,
    amount,
    label: operation.label,
    tagIds: [...operation.tagIds],
    note: operation.note ?? '',
  }
  if (operation.transferGroupId !== null) {
    const isSource = operation.amountCents < 0
    const counterpart = operation.counterpartAccountId ?? undefined
    return {
      ...emptyState('transfer'),
      ...common,
      sourceAccountId: isSource ? operation.accountId : counterpart,
      targetAccountId: isSource ? counterpart : operation.accountId,
    }
  }
  return {
    ...emptyState(operation.amountCents < 0 ? 'expense' : 'income'),
    ...common,
    source: paymentSourceValue(operation.accountId, operation.paymentMethodId),
    categoryId: operation.categoryId ?? undefined,
  }
}

const state = reactive<OperationFormState>(emptyState('expense'))

const edited = computed(() =>
  editor.request?.mode === 'edit' ? editor.request.operation : null,
)
const isTransfer = computed(() => state.kind === 'transfer')

watch(
  () => editor.request,
  async (request) => {
    if (request === null) {
      return
    }
    Object.assign(
      state,
      request.mode === 'create'
        ? emptyState(request.kind)
        : stateFrom(request.operation),
    )
    try {
      await referentials.load()
    } catch (error) {
      toast.add({
        title: errorMessage(error),
        icon: icons.error,
        color: 'error',
      })
    }
    if (request.mode === 'create') {
      applyDefaults()
    }
  },
  { immediate: true },
)

function applyDefaults(): void {
  const [first, second] = referentials.activeAccounts
  state.source ??= paymentSourceValue(first?.id ?? null, null)
  state.sourceAccountId ??= first?.id
  state.targetAccountId ??= second?.id
}

const kindItems = computed<SelectItem<QuickAddKind>[]>(() => {
  const kinds: QuickAddKind[] =
    edited.value === null
      ? ['expense', 'income', 'transfer']
      : isTransfer.value
        ? ['transfer']
        : ['expense', 'income']
  return kinds.map((kind) => ({ label: t(`quickAdd.${kind}`), value: kind }))
})

const sourceItems = computed(() =>
  paymentSourceItems(
    referentials.accounts,
    referentials.paymentMethods,
    state.source,
  ),
)

function keptAccount(id: string | null | undefined): boolean {
  return (
    edited.value !== null &&
    (edited.value.accountId === id || edited.value.counterpartAccountId === id)
  )
}

const accountItems = computed<SelectItem<string>[]>(() =>
  referentials.accounts
    .filter((account) => account.archivedAt === null || keptAccount(account.id))
    .map((account) => ({ label: account.name, value: account.id })),
)

const categoryItems = computed<UiSelectItem[][]>(() => {
  const groups = categoryOptionGroups(
    referentials.categories,
    state.kind === 'income' ? ['income', 'expense'] : ['expense', 'income'],
    state.categoryId,
    (kind) => t(`categories.kinds.${kind}`),
  )
  return [
    [{ label: t('operations.noCategory'), value: noCategory }],
    ...groups.map((group) => [
      { type: 'label' as const, label: group.label },
      ...group.options,
    ]),
  ]
})

const categoryModel = computed({
  get: () => state.categoryId ?? noCategory,
  set: (value: string) => {
    state.categoryId = value === noCategory ? undefined : value
  },
})

const schema = computed(() =>
  isTransfer.value ? transferFormSchema : operationFormSchema,
)

const title = computed(() =>
  edited.value === null
    ? t(`operations.createTitle.${state.kind}`)
    : t('operations.editTitle'),
)

function warnAboutCaps(warnings: readonly CapWarning[]): void {
  for (const warning of warnings) {
    toast.add({
      title: t('caps.warning', {
        account: referentials.accountName(warning.accountId),
        amount: formatMoney(warning.excessCents),
        date: formatDate(warning.date),
      }),
      icon: icons.belowThreshold,
      color: 'warning',
    })
  }
}

async function saveTransfer(): Promise<CapWarning[]> {
  const parsed = transferFormSchema.safeParse(state)
  if (!parsed.success) {
    return []
  }
  const body = {
    sourceAccountId: parsed.data.sourceAccountId,
    targetAccountId: parsed.data.targetAccountId,
    date: parsed.data.date,
    amountCents: parsed.data.amount,
    label: parsed.data.label,
    note: parsed.data.note === '' ? null : parsed.data.note,
    tagIds: state.tagIds,
  }
  const groupId = edited.value?.transferGroupId ?? null
  const saved =
    groupId === null
      ? await apiCall('POST', '/transfers', transferSaveResponseSchema, body)
      : await apiCall(
          'PATCH',
          `/transfers/${groupId}`,
          transferSaveResponseSchema,
          body,
        )
  return saved.capWarnings
}

async function proposeReconciliation(created: Operation): Promise<void> {
  try {
    const { candidates } = await apiGet(
      `/operations/${created.id}/candidates`,
      candidateListResponseSchema,
    )
    if (candidates.length > 0) {
      editor.propose(created)
    }
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  }
}

async function saveOperation(): Promise<CapWarning[]> {
  const parsed = operationFormSchema.safeParse(state)
  if (!parsed.success || state.source === undefined) {
    return []
  }
  const accountId = sourceAccountId(state.source, referentials.paymentMethods)
  if (accountId === null) {
    return []
  }
  const body = {
    accountId,
    paymentMethodId: toPaymentSource(state.source).paymentMethodId,
    date: parsed.data.date,
    amountCents:
      state.kind === 'expense' ? -parsed.data.amount : parsed.data.amount,
    label: parsed.data.label,
    note: parsed.data.note === '' ? null : parsed.data.note,
    categoryId: state.categoryId ?? null,
    tagIds: state.tagIds,
  }
  if (edited.value === null) {
    const created = await apiCall(
      'POST',
      '/operations',
      operationSaveResponseSchema,
      body,
    )
    await proposeReconciliation(created)
    return created.capWarnings
  }
  const updated = await apiCall(
    'PATCH',
    `/operations/${edited.value.id}`,
    operationSaveResponseSchema,
    body,
  )
  return updated.capWarnings
}

async function submit(): Promise<void> {
  saving.value = true
  try {
    const warnings = await (isTransfer.value ? saveTransfer() : saveOperation())
    toast.add({
      title: t('operations.saved'),
      icon: icons.success,
      color: 'success',
    })
    warnAboutCaps(warnings)
    editor.markSaved()
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal v-model:open="editor.isOpen" :title="title" :fullscreen="!isDesktop">
    <template #body>
      <UForm
        :state="state"
        :validate="validator(schema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="operation-form"
        @submit="submit"
      >
        <URadioGroup
          v-if="kindItems.length > 1"
          v-model="state.kind"
          :items="kindItems"
          orientation="horizontal"
          variant="table"
          :legend="t('operations.fields.kind')"
          data-testid="operation-kind"
        />
        <template v-if="isTransfer">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AppFormField
              :label="t('operations.fields.sourceAccount')"
              name="sourceAccountId"
            >
              <USelect
                v-model="state.sourceAccountId"
                :items="accountItems"
                class="w-full"
                data-testid="operation-source-account"
              />
            </AppFormField>
            <AppFormField
              :label="t('operations.fields.targetAccount')"
              name="targetAccountId"
            >
              <USelect
                v-model="state.targetAccountId"
                :items="accountItems"
                class="w-full"
                data-testid="operation-target-account"
              />
            </AppFormField>
          </div>
        </template>
        <AppFormField
          v-else
          :label="t('operations.fields.source')"
          name="source"
        >
          <USelect
            v-model="state.source"
            :items="sourceItems"
            class="w-full"
            data-testid="operation-source"
          />
        </AppFormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField :label="t('operations.fields.amount')" name="amount">
            <UInput
              v-model="state.amount"
              inputmode="decimal"
              class="w-full"
              :ui="{ base: 'text-right tabular-nums' }"
              data-testid="operation-amount"
            >
              <template #trailing>
                <span class="text-sm text-muted">{{ t('money.symbol') }}</span>
              </template>
            </UInput>
          </AppFormField>
          <AppFormField :label="t('operations.fields.date')" name="date">
            <UInput
              v-model="state.date"
              type="date"
              class="w-full"
              :ui="{ base: 'tabular-nums' }"
              data-testid="operation-date"
            />
          </AppFormField>
        </div>
        <AppFormField :label="t('operations.fields.label')" name="label">
          <UInput
            v-model="state.label"
            class="w-full"
            data-testid="operation-label"
          />
        </AppFormField>
        <AppFormField
          v-if="!isTransfer"
          :label="t('operations.fields.category')"
          :hint="t('common.optional')"
          name="categoryId"
        >
          <USelect
            v-model="categoryModel"
            :items="categoryItems"
            class="w-full"
            data-testid="operation-category"
          />
        </AppFormField>
        <AppFormField
          :label="t('operations.fields.tags')"
          :hint="t('common.optional')"
          name="tagIds"
        >
          <TagSelect v-model="state.tagIds" test-id="operation-tags" />
        </AppFormField>
        <AppFormField
          :label="t('operations.fields.note')"
          :hint="t('common.optional')"
          name="note"
        >
          <UTextarea v-model="state.note" :rows="2" class="w-full" />
        </AppFormField>
        <OperationLinksPanel
          v-if="edited !== null && edited.transferGroupId === null"
          :operation="edited"
        />
        <OfflineGuard block v-slot="{ offline }">
          <UButton
            :disabled="offline"
            type="submit"
            :label="t('common.save')"
            :loading="saving"
            color="primary"
            variant="solid"
            block
            data-testid="operation-submit"
          />
        </OfflineGuard>
      </UForm>
    </template>
  </UModal>
</template>
