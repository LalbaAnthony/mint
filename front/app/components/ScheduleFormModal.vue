<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { FormError } from '@nuxt/ui'
import {
  businessDayRules,
  defaultReminderDaysBefore,
  maxReminderDaysBefore,
  scheduleFieldIssues,
  scheduleFrequencies,
  scheduleKinds,
  scheduleSchema,
  triggerModes,
  updateScheduleResponseSchema,
} from '@mint/shared/schemas/schedules'
import type {
  BusinessDayRule,
  Schedule,
  ScheduleFields,
  ScheduleFrequency,
  ScheduleKind,
  TriggerMode,
} from '@mint/shared/types/schedules'
import { scheduleFormSchema } from '~~/schemas/forms'
import type { SelectItem } from '~~/types/forms'
import type {
  ScheduleEndMode,
  ScheduleFormModalEmits,
  ScheduleFormModalProps,
  ScheduleFormState,
} from '~~/types/planning'

const props = defineProps<ScheduleFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<ScheduleFormModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, toFormErrors, errorMessage } = useFormValidation()
const referentials = useReferentialsStore()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const saving = ref(false)

function emptyState(): ScheduleFormState {
  return {
    kind: 'expense',
    label: '',
    amount: '',
    source: undefined,
    sourceAccountId: undefined,
    targetAccountId: undefined,
    categoryId: undefined,
    isSubscription: false,
    triggerMode: 'auto',
    reminderDaysBefore: defaultReminderDaysBefore,
    frequency: 'monthly',
    interval: 1,
    startDate: parisDate(new Date()),
    anchorLastDay: false,
    endMode: 'never',
    endDate: '',
    maxOccurrences: 12,
    businessDayRule: 'exact',
    note: '',
    amountTolerancePct: 10,
    bankLabelPatterns: [],
    tagIds: [],
    active: true,
  }
}

function endModeOf(schedule: Schedule): ScheduleEndMode {
  if (schedule.endDate !== null) {
    return 'date'
  }
  return schedule.maxOccurrences === null ? 'never' : 'count'
}

function stateFrom(schedule: Schedule): ScheduleFormState {
  return {
    kind: schedule.kind,
    label: schedule.label,
    amount: formatAmountInput(schedule.amountCents, locale.value),
    source: paymentSourceValue(schedule.accountId, schedule.paymentMethodId),
    sourceAccountId: schedule.sourceAccountId ?? undefined,
    targetAccountId: schedule.targetAccountId ?? undefined,
    categoryId: schedule.categoryId ?? undefined,
    isSubscription: schedule.isSubscription,
    triggerMode: schedule.triggerMode,
    reminderDaysBefore: schedule.reminderDaysBefore,
    frequency: schedule.frequency,
    interval: schedule.interval,
    startDate: schedule.startDate,
    anchorLastDay: schedule.anchorLastDay,
    endMode: endModeOf(schedule),
    endDate: schedule.endDate ?? '',
    maxOccurrences: schedule.maxOccurrences ?? 12,
    businessDayRule: schedule.businessDayRule,
    note: schedule.note ?? '',
    amountTolerancePct: schedule.amountTolerancePct,
    bankLabelPatterns: [...schedule.bankLabelPatterns],
    tagIds: [...schedule.tagIds],
    active: schedule.active,
  }
}

const state = reactive<ScheduleFormState>(emptyState())

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      Object.assign(
        state,
        props.schedule === null ? emptyState() : stateFrom(props.schedule),
      )
      if (props.schedule === null) {
        const accountId = referentials.prefilledAccountId
        state.source = paymentSourceValue(accountId, null)
        state.sourceAccountId = accountId ?? undefined
      }
    }
  },
  { immediate: true },
)

const isCreation = computed(() => props.schedule === null)
const isTransfer = computed(() => state.kind === 'transfer')
const isOnce = computed(() => state.frequency === 'once')
const allowsLastDay = computed(
  () => state.frequency === 'monthly' || state.frequency === 'yearly',
)

const kindItems = computed<SelectItem<ScheduleKind>[]>(() =>
  scheduleKinds.map((kind) => ({
    label: t(`schedules.kinds.${kind}`),
    value: kind,
  })),
)

const frequencyItems = computed<SelectItem<ScheduleFrequency>[]>(() =>
  scheduleFrequencies.map((frequency) => ({
    label: t(`schedules.frequencies.${frequency}`),
    value: frequency,
  })),
)

const ruleItems = computed<SelectItem<BusinessDayRule>[]>(() =>
  businessDayRules.map((rule) => ({
    label: t(`schedules.businessDayRules.${rule}`),
    value: rule,
  })),
)

const modeItems = computed<SelectItem<TriggerMode>[]>(() =>
  triggerModes.map((mode) => ({
    label: t(`schedules.triggerModes.${mode}`),
    value: mode,
  })),
)

const endModeItems = computed<SelectItem<ScheduleEndMode>[]>(() =>
  (['never', 'date', 'count'] as const).map((mode) => ({
    label: t(`schedules.endModes.${mode}`),
    value: mode,
  })),
)

const sourceItems = computed(() =>
  paymentSourceItems(
    referentials.accounts,
    referentials.paymentMethods,
    state.source,
  ),
)

const accountItems = computed<SelectItem<string>[]>(() =>
  referentials.accounts
    .filter(
      (account) =>
        account.archivedAt === null ||
        account.id === state.sourceAccountId ||
        account.id === state.targetAccountId,
    )
    .map((account) => ({ label: account.name, value: account.id })),
)

const categoryItems = computed<SelectItem<string>[]>(() =>
  state.kind === 'transfer'
    ? []
    : categoryOptionGroups(
        referentials.categories,
        [state.kind],
        state.categoryId,
        (kind) => t(`categories.kinds.${kind}`),
      ).flatMap((group) => group.options),
)

watch(
  () => state.kind,
  () => {
    if (
      state.categoryId !== undefined &&
      !categoryItems.value.some((item) => item.value === state.categoryId)
    ) {
      state.categoryId = undefined
    }
  },
)

function draftFields(): ScheduleFields | null {
  const amount = parseAmountInput(state.amount, locale.value)
  if (amount === null) {
    return null
  }
  const common = {
    label: state.label.trim(),
    amountCents: amount,
    triggerMode: state.triggerMode,
    reminderDaysBefore: state.reminderDaysBefore,
    note: state.note.trim() === '' ? null : state.note.trim(),
    active: state.active,
    frequency: state.frequency,
    interval: isOnce.value ? 1 : state.interval,
    startDate: state.startDate,
    anchorLastDay: allowsLastDay.value && state.anchorLastDay,
    endDate: !isOnce.value && state.endMode === 'date' ? state.endDate : null,
    maxOccurrences:
      !isOnce.value && state.endMode === 'count' ? state.maxOccurrences : null,
    businessDayRule: state.businessDayRule,
    amountTolerancePct: state.amountTolerancePct,
    bankLabelPatterns: state.bankLabelPatterns,
    tagIds: state.tagIds,
  }
  if (state.kind === 'transfer') {
    return {
      ...common,
      kind: 'transfer',
      sourceAccountId: state.sourceAccountId ?? '',
      targetAccountId: state.targetAccountId ?? '',
    }
  }
  const source =
    state.source === undefined
      ? { accountId: null, paymentMethodId: null }
      : toPaymentSource(state.source)
  const categorized = {
    ...common,
    ...source,
    categoryId: state.categoryId ?? '',
  }
  return state.kind === 'expense'
    ? { ...categorized, kind: 'expense', isSubscription: state.isSubscription }
    : { ...categorized, kind: 'income' }
}

function sourcePath(field: string): string {
  return field === 'accountId' ? 'source' : field
}

function validate(current: ScheduleFormState): FormError[] {
  const errors = validator(scheduleFormSchema(locale.value))(current)
  const required = (name: string, missing: boolean) =>
    missing ? toFormErrors([{ path: [name], message: 'required' }]) : []
  const fields = draftFields()
  const consistency =
    fields === null
      ? []
      : toFormErrors(
          scheduleFieldIssues(fields)
            .filter(
              (issue) =>
                issue.message !== 'payment_or_account_required' ||
                current.source !== undefined,
            )
            .map((issue) => ({
              path: issue.path.map(sourcePath),
              message: issue.message,
            })),
        )
  return [
    ...errors,
    ...(current.kind === 'transfer'
      ? [
          ...required('sourceAccountId', current.sourceAccountId === undefined),
          ...required('targetAccountId', current.targetAccountId === undefined),
        ]
      : [
          ...required('source', current.source === undefined),
          ...required('categoryId', current.categoryId === undefined),
        ]),
    ...required(
      'endDate',
      !isOnce.value && current.endMode === 'date' && current.endDate === '',
    ),
    ...consistency,
  ]
}

async function submit(): Promise<void> {
  const fields = draftFields()
  if (fields === null || validate(state).length > 0) {
    return
  }
  saving.value = true
  try {
    if (props.schedule === null) {
      const created = await apiCall(
        'POST',
        '/schedules',
        scheduleSchema,
        fields,
      )
      emit('saved', created, 0)
    } else {
      const { kind: _kind, ...changes } = fields
      const updated = await apiCall(
        'PATCH',
        `/schedules/${props.schedule.id}`,
        updateScheduleResponseSchema,
        changes,
      )
      emit('saved', updated.schedule, updated.removedExceptions)
    }
    open.value = false
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="isCreation ? t('schedules.createTitle') : t('schedules.editTitle')"
    :fullscreen="!isDesktop"
  >
    <template #body>
      <AppForm
        :state="state"
        :validate="validate"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="schedule-form"
        @submit="submit"
      >
        <URadioGroup
          v-if="isCreation"
          v-model="state.kind"
          :items="kindItems"
          orientation="horizontal"
          variant="table"
          :legend="t('schedules.fields.kind')"
          :ui="scrollableRadioGroupUi"
          data-testid="schedule-kind"
        />
        <p v-else class="text-sm text-muted">
          {{
            t('schedules.kindFixed', {
              kind: t(`schedules.kinds.${state.kind}`),
            })
          }}
        </p>
        <AppFormField :label="t('schedules.fields.label')" name="label">
          <UInput
            v-model="state.label"
            class="w-full"
            data-testid="schedule-label"
          />
        </AppFormField>
        <AppFormField :label="t('schedules.fields.amount')" name="amount">
          <AmountInput v-model="state.amount" data-testid="schedule-amount" />
        </AppFormField>
        <div v-if="isTransfer" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField
            :label="t('operations.fields.sourceAccount')"
            name="sourceAccountId"
          >
            <USelect
              v-model="state.sourceAccountId"
              :items="accountItems"
              class="w-full"
              data-testid="schedule-source-account"
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
              data-testid="schedule-target-account"
            />
          </AppFormField>
        </div>
        <template v-else>
          <AppFormField :label="t('operations.fields.source')" name="source">
            <USelect
              v-model="state.source"
              :items="sourceItems"
              class="w-full"
              data-testid="schedule-source"
            />
          </AppFormField>
          <AppFormField
            :label="t('operations.fields.category')"
            name="categoryId"
          >
            <USelect
              v-model="state.categoryId"
              :items="categoryItems"
              class="w-full"
              data-testid="schedule-category"
            />
          </AppFormField>
          <USwitch
            v-if="state.kind === 'expense'"
            v-model="state.isSubscription"
            :label="t('schedules.fields.isSubscription')"
            data-testid="schedule-subscription"
          />
        </template>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField
            :label="t('schedules.fields.frequency')"
            name="frequency"
          >
            <USelect
              v-model="state.frequency"
              :items="frequencyItems"
              class="w-full"
              data-testid="schedule-frequency"
            />
          </AppFormField>
          <AppFormField
            v-if="!isOnce"
            :label="t('schedules.fields.interval')"
            name="interval"
          >
            <UInputNumber
              v-model="state.interval"
              :min="1"
              :max="99"
              class="w-full"
              data-testid="schedule-interval"
            />
          </AppFormField>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField
            :label="
              isOnce
                ? t('schedules.fields.date')
                : t('schedules.fields.startDate')
            "
            name="startDate"
          >
            <UInput
              v-model="state.startDate"
              type="date"
              class="w-full"
              :ui="{ base: 'tabular-nums' }"
              data-testid="schedule-start-date"
            />
          </AppFormField>
          <AppFormField
            :label="t('schedules.fields.businessDayRule')"
            name="businessDayRule"
          >
            <USelect
              v-model="state.businessDayRule"
              :items="ruleItems"
              class="w-full"
              data-testid="schedule-business-day-rule"
            />
          </AppFormField>
        </div>
        <USwitch
          v-if="allowsLastDay"
          v-model="state.anchorLastDay"
          :label="t('schedules.fields.anchorLastDay')"
        />
        <div v-if="!isOnce" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField :label="t('schedules.fields.end')" name="endMode">
            <USelect
              v-model="state.endMode"
              :items="endModeItems"
              class="w-full"
            />
          </AppFormField>
          <AppFormField
            v-if="state.endMode === 'date'"
            :label="t('schedules.fields.endDate')"
            name="endDate"
          >
            <UInput v-model="state.endDate" type="date" class="w-full" />
          </AppFormField>
          <AppFormField
            v-if="state.endMode === 'count'"
            :label="t('schedules.fields.maxOccurrences')"
            name="maxOccurrences"
          >
            <UInputNumber
              v-model="state.maxOccurrences"
              :min="1"
              :max="999"
              class="w-full"
            />
          </AppFormField>
        </div>
        <AppFormField
          :label="t('schedules.fields.triggerMode')"
          name="triggerMode"
        >
          <USelect
            v-model="state.triggerMode"
            :items="modeItems"
            class="w-full"
            data-testid="schedule-trigger-mode"
          />
        </AppFormField>
        <AppFormField
          v-if="state.triggerMode === 'manual'"
          :label="t('schedules.fields.reminderDaysBefore')"
          :hint="t('schedules.fields.reminderDaysBeforeHint')"
          name="reminderDaysBefore"
        >
          <UInputNumber
            v-model="state.reminderDaysBefore"
            :min="0"
            :max="maxReminderDaysBefore"
            class="w-full"
            data-testid="schedule-reminder-days"
          />
        </AppFormField>
        <AppFormField
          :label="t('operations.fields.tags')"
          :hint="t('common.optional')"
          name="tagIds"
        >
          <TagSelect v-model="state.tagIds" test-id="schedule-tags" />
        </AppFormField>
        <AppFormField
          :label="t('operations.fields.note')"
          :hint="t('common.optional')"
          name="note"
        >
          <UTextarea v-model="state.note" :rows="2" class="w-full" />
        </AppFormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField
            :label="t('schedules.fields.amountTolerance')"
            :hint="t('schedules.fields.amountToleranceHint')"
            name="amountTolerancePct"
          >
            <UInputNumber
              v-model="state.amountTolerancePct"
              :min="0"
              :max="100"
              class="w-full"
              data-testid="schedule-tolerance"
            />
          </AppFormField>
          <AppFormField
            :label="t('schedules.fields.bankLabelPatterns')"
            :hint="t('schedules.fields.bankLabelPatternsHint')"
            name="bankLabelPatterns"
          >
            <UInputTags
              v-model="state.bankLabelPatterns"
              class="w-full"
              data-testid="schedule-patterns"
            />
          </AppFormField>
        </div>
        <USwitch v-model="state.active" :label="t('schedules.fields.active')" />
        <OfflineGuard block v-slot="{ offline }">
          <UButton
            :disabled="offline"
            type="submit"
            :label="t('common.save')"
            :loading="saving"
            color="primary"
            variant="solid"
            block
            data-testid="schedule-submit"
          />
        </OfflineGuard>
      </AppForm>
    </template>
  </UModal>
</template>
