<script setup lang="ts">
import { addDays } from '@mint/shared/engines/dates'
import { scheduleOccurrenceSchema } from '@mint/shared/schemas/schedules'
import { occurrenceFormSchema } from '~~/schemas/forms'
import type {
  OccurrenceFormModalEmits,
  OccurrenceFormModalProps,
  OccurrenceFormState,
} from '~~/types/planning'

const props = defineProps<OccurrenceFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<OccurrenceFormModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const { formatDate } = useFormatters()

const saving = ref(false)
const state = reactive<OccurrenceFormState>({ amount: '', effectiveDate: '' })

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      state.amount = ''
      state.effectiveDate = ''
    }
  },
  { immediate: true },
)

const amountPlaceholder = computed(() =>
  props.occurrence === null
    ? ''
    : formatAmountInput(props.occurrence.amountCents, locale.value),
)

const tomorrow = computed(() => addDays(parisDate(new Date()), 1))

const schema = computed(() => occurrenceFormSchema(locale.value))

async function submit(): Promise<void> {
  const occurrence = props.occurrence
  if (occurrence === null || !schema.value.safeParse(state).success) {
    return
  }
  saving.value = true
  try {
    const saved = await apiCall(
      'POST',
      `/schedules/${props.scheduleId}/occurrences/${occurrence.originalDate}/override`,
      scheduleOccurrenceSchema,
      {
        amountCents:
          state.amount.trim() === ''
            ? null
            : parseAmountInput(state.amount, locale.value),
        effectiveDate: state.effectiveDate === '' ? null : state.effectiveDate,
      },
    )
    emit('saved', saved)
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
    :title="t('schedules.occurrences.editTitle')"
    :description="
      occurrence === null
        ? ''
        : t('schedules.occurrences.editHelp', {
            date: formatDate(occurrence.originalDate),
          })
    "
  >
    <template #body>
      <AppForm
        :state="state"
        :validate="validator(schema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="occurrence-form"
        @submit="submit"
      >
        <AppFormField :label="t('schedules.occurrences.amount')" name="amount">
          <AmountInput
            v-model="state.amount"
            :placeholder="amountPlaceholder"
            data-testid="occurrence-amount"
          />
        </AppFormField>
        <AppFormField
          :label="t('schedules.occurrences.date')"
          name="effectiveDate"
        >
          <UInput
            v-model="state.effectiveDate"
            type="date"
            :min="tomorrow"
            :placeholder="occurrence?.effectiveDate"
            class="w-full"
            :ui="{ base: 'tabular-nums' }"
            data-testid="occurrence-date"
          />
        </AppFormField>
        <OfflineGuard block v-slot="{ offline }">
          <ShortcutTooltip shortcut="submit">
            <UButton
              :disabled="offline"
              type="submit"
              :label="t('common.save')"
              :loading="saving"
              color="primary"
              variant="solid"
              block
              data-testid="occurrence-submit"
            />
          </ShortcutTooltip>
        </OfflineGuard>
      </AppForm>
    </template>
  </UModal>
</template>
