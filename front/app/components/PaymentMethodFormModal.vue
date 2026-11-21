<script setup lang="ts">
import {
  createPaymentMethodRequestSchema,
  paymentMethodKinds,
  paymentMethodSchema,
} from '@mint/shared/schemas/payment-methods'
import type { PaymentMethodKind } from '@mint/shared/types/payment-methods'
import type {
  PaymentMethodFormModalEmits,
  PaymentMethodFormModalProps,
} from '~~/types/components'
import type { PaymentMethodFormState, SelectItem } from '~~/types/forms'

const props = defineProps<PaymentMethodFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<PaymentMethodFormModalEmits>()

const { t } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()

const saving = ref(false)
const state = reactive<PaymentMethodFormState>({
  label: '',
  kind: 'card',
  accountId: undefined,
})

watch(
  open,
  (isOpen) => {
    if (!isOpen) {
      return
    }
    const paymentMethod = props.paymentMethod
    Object.assign(
      state,
      paymentMethod === null
        ? { label: '', kind: 'card', accountId: props.accountId ?? undefined }
        : {
            label: paymentMethod.label,
            kind: paymentMethod.kind,
            accountId: paymentMethod.accountId,
          },
    )
  },
  { immediate: true },
)

const kindItems = computed<SelectItem<PaymentMethodKind>[]>(() =>
  paymentMethodKinds.map((kind) => ({
    label: t(`paymentMethods.kinds.${kind}`),
    value: kind,
  })),
)

const accountItems = computed<SelectItem<string>[]>(() =>
  props.accounts.map((account) => ({ label: account.name, value: account.id })),
)

async function submit(): Promise<void> {
  const parsed = createPaymentMethodRequestSchema.safeParse(state)
  if (!parsed.success) {
    return
  }
  saving.value = true
  try {
    const saved =
      props.paymentMethod === null
        ? await apiCall(
            'POST',
            '/payment-methods',
            paymentMethodSchema,
            parsed.data,
          )
        : await apiCall(
            'PATCH',
            `/payment-methods/${props.paymentMethod.id}`,
            paymentMethodSchema,
            parsed.data,
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
      paymentMethod === null
        ? t('paymentMethods.createTitle')
        : t('paymentMethods.editTitle')
    "
  >
    <template #body>
      <AppForm
        :state="state"
        :validate="validator(createPaymentMethodRequestSchema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="payment-method-form"
        @submit="submit"
      >
        <AppFormField :label="t('paymentMethods.fields.label')" name="label">
          <UInput
            v-model="state.label"
            class="w-full"
            data-testid="payment-method-label"
          />
        </AppFormField>
        <AppFormField :label="t('paymentMethods.fields.kind')" name="kind">
          <USelect
            v-model="state.kind"
            :items="kindItems"
            class="w-full"
            data-testid="payment-method-kind"
          />
        </AppFormField>
        <AppFormField
          :label="t('paymentMethods.fields.account')"
          name="accountId"
        >
          <USelect
            v-model="state.accountId"
            :items="accountItems"
            class="w-full"
            data-testid="payment-method-account"
          />
        </AppFormField>
        <OfflineGuard block v-slot="{ offline }">
          <UButton
            :disabled="offline"
            type="submit"
            :label="t('common.save')"
            :loading="saving"
            color="primary"
            variant="solid"
            block
            data-testid="payment-method-submit"
          />
        </OfflineGuard>
      </AppForm>
    </template>
  </UModal>
</template>
