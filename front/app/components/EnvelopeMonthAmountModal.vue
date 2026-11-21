<script setup lang="ts">
import { envelopeMonthOverrideSchema } from '@mint/shared/schemas/envelopes'
import { envelopeMonthAmountFormSchema } from '~~/schemas/forms'
import type {
  EnvelopeMonthAmountFormState,
  EnvelopeMonthAmountModalEmits,
  EnvelopeMonthAmountModalProps,
} from '~~/types/planning'

const props = defineProps<EnvelopeMonthAmountModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<EnvelopeMonthAmountModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const { formatMoney, formatMonth } = useFormatters()

const saving = ref(false)
const restoring = ref(false)
const state = reactive<EnvelopeMonthAmountFormState>({ amount: '' })

watch(
  open,
  (isOpen) => {
    if (isOpen && props.line !== null) {
      state.amount = formatAmountInput(
        props.line.status.budgetCents,
        locale.value,
      )
    }
  },
  { immediate: true },
)

const monthPath = computed(() =>
  props.line === null
    ? ''
    : `/envelopes/${props.line.envelope.id}/months/${props.month}`,
)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const schema = computed(() => envelopeMonthAmountFormSchema(locale.value))

async function submit(): Promise<void> {
  const parsed = schema.value.safeParse(state)
  const line = props.line
  if (!parsed.success || line === null) {
    return
  }
  saving.value = true
  try {
    await apiCall('POST', monthPath.value, envelopeMonthOverrideSchema, {
      amountCents: parsed.data.amount,
    })
    emit('saved', line.envelope.label)
    open.value = false
  } catch (error) {
    notifyFailure(error)
  } finally {
    saving.value = false
  }
}

async function restore(): Promise<void> {
  const line = props.line
  if (line === null) {
    return
  }
  restoring.value = true
  try {
    await apiCommand('DELETE', monthPath.value)
    emit('saved', line.envelope.label)
    open.value = false
  } catch (error) {
    notifyFailure(error)
  } finally {
    restoring.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('envelopes.monthAmountTitle', { month: formatMonth(month) })"
    :description="
      line === null
        ? undefined
        : t('envelopes.monthAmountHelp', {
            label: line.envelope.label,
            amount: formatMoney(line.envelope.monthlyAmountCents),
          })
    "
  >
    <template #body>
      <AppForm
        :state="state"
        :validate="validator(schema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="envelope-month-form"
        @submit="submit"
      >
        <AppFormField :label="t('envelopes.fields.monthAmount')" name="amount">
          <AmountInput
            v-model="state.amount"
            data-testid="envelope-month-amount"
          />
        </AppFormField>
        <div class="flex flex-col gap-2 sm:flex-row-reverse">
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              type="submit"
              :label="t('common.save')"
              :loading="saving"
              color="primary"
              variant="solid"
              class="justify-center"
              data-testid="envelope-month-submit"
            />
          </OfflineGuard>
          <OfflineGuard v-if="line?.status.overridden" v-slot="{ offline }">
            <UButton
              :disabled="offline"
              :label="t('envelopes.restoreMonthlyAmount')"
              :loading="restoring"
              color="neutral"
              variant="outline"
              class="justify-center"
              data-testid="envelope-month-restore"
              @click="restore"
            />
          </OfflineGuard>
        </div>
      </AppForm>
    </template>
  </UModal>
</template>
