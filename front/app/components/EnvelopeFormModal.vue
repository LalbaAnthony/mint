<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { envelopeSchema } from '@mint/shared/schemas/envelopes'
import type { Envelope } from '@mint/shared/types/envelopes'
import { envelopeFormSchema } from '~~/schemas/forms'
import type { SelectItem } from '~~/types/forms'
import type {
  EnvelopeFormModalEmits,
  EnvelopeFormModalProps,
  EnvelopeFormState,
} from '~~/types/planning'

const props = defineProps<EnvelopeFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<EnvelopeFormModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const referentials = useReferentialsStore()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const saving = ref(false)

function emptyState(): EnvelopeFormState {
  return {
    label: '',
    amount: '',
    source: undefined,
    carryOver: false,
    active: true,
    categoryIds: [],
  }
}

function stateFrom(envelope: Envelope): EnvelopeFormState {
  return {
    label: envelope.label,
    amount: formatAmountInput(envelope.monthlyAmountCents, locale.value),
    source: paymentSourceValue(envelope.accountId, envelope.paymentMethodId),
    carryOver: envelope.carryOver,
    active: envelope.active,
    categoryIds: [...envelope.categoryIds],
  }
}

const state = reactive<EnvelopeFormState>(emptyState())

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      Object.assign(
        state,
        props.envelope === null ? emptyState() : stateFrom(props.envelope),
      )
      if (props.envelope === null) {
        state.source = paymentSourceValue(
          referentials.activeAccounts[0]?.id ?? null,
          null,
        )
      }
    }
  },
  { immediate: true },
)

const sourceItems = computed(() =>
  paymentSourceItems(
    referentials.accounts,
    referentials.paymentMethods,
    state.source,
  ),
)

const categoryItems = computed<SelectItem<string>[]>(() => {
  const own = new Set(props.envelope?.categoryIds ?? [])
  return categoryOptionGroups(
    referentials.categories,
    ['expense'],
    undefined,
    (kind) => t(`categories.kinds.${kind}`),
  )
    .flatMap((group) => group.options)
    .filter(
      (option) =>
        own.has(option.value) || !props.takenCategoryIds.includes(option.value),
    )
})

async function submit(): Promise<void> {
  const parsed = envelopeFormSchema.safeParse(state)
  if (!parsed.success || state.source === undefined) {
    return
  }
  const body = {
    label: parsed.data.label,
    monthlyAmountCents: parsed.data.amount,
    ...toPaymentSource(state.source),
    carryOver: state.carryOver,
    active: state.active,
    categoryIds: parsed.data.categoryIds,
  }
  saving.value = true
  try {
    const saved =
      props.envelope === null
        ? await apiCall('POST', '/envelopes', envelopeSchema, body)
        : await apiCall(
            'PATCH',
            `/envelopes/${props.envelope.id}`,
            envelopeSchema,
            body,
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
    :title="
      envelope === null ? t('envelopes.createTitle') : t('envelopes.editTitle')
    "
    :fullscreen="!isDesktop"
  >
    <template #body>
      <UForm
        :state="state"
        :validate="validator(envelopeFormSchema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="envelope-form"
        @submit="submit"
      >
        <AppFormField :label="t('envelopes.fields.label')" name="label">
          <UInput
            v-model="state.label"
            class="w-full"
            data-testid="envelope-label"
          />
        </AppFormField>
        <AppFormField :label="t('envelopes.fields.amount')" name="amount">
          <UInput
            v-model="state.amount"
            inputmode="decimal"
            class="w-full"
            :ui="{ base: 'text-right tabular-nums' }"
            data-testid="envelope-amount"
          >
            <template #trailing>
              <span class="text-sm text-muted">{{ t('money.symbol') }}</span>
            </template>
          </UInput>
        </AppFormField>
        <AppFormField :label="t('envelopes.fields.source')" name="source">
          <USelect
            v-model="state.source"
            :items="sourceItems"
            class="w-full"
            data-testid="envelope-source"
          />
        </AppFormField>
        <AppFormField
          :label="t('envelopes.fields.categories')"
          name="categoryIds"
        >
          <USelectMenu
            v-model="state.categoryIds"
            :items="categoryItems"
            value-key="value"
            multiple
            class="w-full"
            data-testid="envelope-categories"
          />
        </AppFormField>
        <USwitch
          v-model="state.carryOver"
          :label="t('envelopes.fields.carryOver')"
          :description="t('envelopes.fields.carryOverHelp')"
        />
        <USwitch v-model="state.active" :label="t('envelopes.fields.active')" />
        <OfflineGuard block v-slot="{ offline }">
          <UButton
            :disabled="offline"
            type="submit"
            :label="t('common.save')"
            :loading="saving"
            color="primary"
            variant="solid"
            block
            data-testid="envelope-submit"
          />
        </OfflineGuard>
      </UForm>
    </template>
  </UModal>
</template>
