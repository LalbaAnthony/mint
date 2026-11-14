<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import {
  accountNatures,
  accountSchema,
  accountUsages,
  productsForNature,
} from '@mint/shared/schemas/accounts'
import type {
  Account,
  AccountNature,
  AccountUsage,
  CreateAccountRequest,
  RegulatedProduct,
} from '@mint/shared/types/accounts'
import { accountFormSchema } from '~~/schemas/forms'
import type {
  AccountFormModalEmits,
  AccountFormModalProps,
} from '~~/types/components'
import type { AccountFormState, SelectItem } from '~~/types/forms'

const props = defineProps<AccountFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<AccountFormModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const today = ref(parisDate(new Date()))
const saving = ref(false)

function emptyState(): AccountFormState {
  return {
    name: '',
    nature: 'current_account',
    regulatedProduct: null,
    usage: 'current',
    institution: '',
    initialBalance: '',
    initialBalanceDate: today.value,
    lowBalanceThreshold: '',
  }
}

function stateFrom(account: Account): AccountFormState {
  return {
    name: account.name,
    nature: account.nature,
    regulatedProduct: account.regulatedProduct,
    usage: account.usage,
    institution: account.institution ?? '',
    initialBalance: formatAmountInput(
      account.initialBalanceCents,
      locale.value,
    ),
    initialBalanceDate: account.initialBalanceDate,
    lowBalanceThreshold:
      account.lowBalanceThresholdCents === null
        ? ''
        : formatAmountInput(account.lowBalanceThresholdCents, locale.value),
  }
}

const state = reactive<AccountFormState>(emptyState())

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      today.value = parisDate(new Date())
      Object.assign(
        state,
        props.account === null ? emptyState() : stateFrom(props.account),
      )
    }
  },
  { immediate: true },
)

watch(
  () => state.nature,
  (nature) => {
    const allowed = productsForNature(nature)
    if (
      state.regulatedProduct !== null &&
      !allowed.includes(state.regulatedProduct)
    ) {
      state.regulatedProduct = null
    }
  },
)

const schema = computed(() => accountFormSchema(today.value))

const regulatedProductModel = computed({
  get: () => state.regulatedProduct ?? undefined,
  set: (product: RegulatedProduct | undefined) => {
    state.regulatedProduct = product ?? null
  },
})

const natureItems = computed<SelectItem<AccountNature>[]>(() =>
  accountNatures.map((nature) => ({
    label: t(`accounts.natures.${nature}`),
    value: nature,
  })),
)

const productItems = computed<SelectItem<RegulatedProduct>[]>(() =>
  productsForNature(state.nature).map((product) => ({
    label: t(`accounts.products.${product}`),
    value: product,
  })),
)

const usageItems = computed<SelectItem<AccountUsage>[]>(() =>
  accountUsages.map((usage) => ({
    label: t(`accounts.usages.${usage}`),
    value: usage,
  })),
)

async function submit(): Promise<void> {
  const parsed = schema.value.safeParse(state)
  if (!parsed.success) {
    return
  }
  const body: CreateAccountRequest = {
    name: parsed.data.name,
    nature: parsed.data.nature,
    regulatedProduct: parsed.data.regulatedProduct,
    usage: parsed.data.usage,
    institution: parsed.data.institution,
    initialBalanceCents: parsed.data.initialBalance,
    initialBalanceDate: parsed.data.initialBalanceDate,
    lowBalanceThresholdCents: parsed.data.lowBalanceThreshold,
  }
  saving.value = true
  try {
    const saved =
      props.account === null
        ? await apiCall('POST', '/accounts', accountSchema, body)
        : await apiCall(
            'PATCH',
            `/accounts/${props.account.id}`,
            accountSchema,
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
      account === null ? t('accounts.createTitle') : t('accounts.editTitle')
    "
    :fullscreen="!isDesktop"
  >
    <template #body>
      <UForm
        :state="state"
        :validate="validator(schema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="account-form"
        @submit="submit"
      >
        <AppFormField :label="t('accounts.fields.name')" name="name">
          <UInput
            v-model="state.name"
            class="w-full"
            data-testid="account-name-input"
          />
        </AppFormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField :label="t('accounts.fields.nature')" name="nature">
            <USelect
              v-model="state.nature"
              :items="natureItems"
              class="w-full"
              data-testid="account-nature"
            />
          </AppFormField>
          <AppFormField
            v-if="productItems.length > 0"
            :label="t('accounts.fields.product')"
            name="regulatedProduct"
          >
            <USelect
              v-model="regulatedProductModel"
              :items="productItems"
              :placeholder="t('accounts.fields.productPlaceholder')"
              class="w-full"
              data-testid="account-product"
            />
          </AppFormField>
        </div>
        <AppFormField :label="t('accounts.fields.usage')" name="usage">
          <USelect
            v-model="state.usage"
            :items="usageItems"
            class="w-full"
            data-testid="account-usage"
          />
        </AppFormField>
        <AppFormField
          :label="t('accounts.fields.institution')"
          :hint="t('common.optional')"
          name="institution"
        >
          <UInput v-model="state.institution" class="w-full" />
        </AppFormField>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField
            :label="t('accounts.fields.initialBalance')"
            name="initialBalance"
          >
            <UInput
              v-model="state.initialBalance"
              inputmode="decimal"
              class="w-full"
              :ui="{ base: 'text-right tabular-nums' }"
              data-testid="account-initial-balance"
            >
              <template #trailing>
                <span class="text-sm text-muted">{{ t('money.symbol') }}</span>
              </template>
            </UInput>
          </AppFormField>
          <AppFormField
            :label="t('accounts.fields.initialBalanceDate')"
            name="initialBalanceDate"
          >
            <UInput
              v-model="state.initialBalanceDate"
              type="date"
              :max="today"
              class="w-full"
              :ui="{ base: 'tabular-nums' }"
              data-testid="account-initial-date"
            />
          </AppFormField>
        </div>
        <AppFormField
          :label="t('accounts.fields.lowBalanceThreshold')"
          :hint="t('common.optional')"
          name="lowBalanceThreshold"
        >
          <UInput
            v-model="state.lowBalanceThreshold"
            inputmode="decimal"
            class="w-full"
            :ui="{ base: 'text-right tabular-nums' }"
            data-testid="account-threshold"
          >
            <template #trailing>
              <span class="text-sm text-muted">{{ t('money.symbol') }}</span>
            </template>
          </UInput>
        </AppFormField>
        <UButton
          type="submit"
          :label="t('common.save')"
          :loading="saving"
          color="primary"
          variant="solid"
          block
          data-testid="account-submit"
        />
      </UForm>
    </template>
  </UModal>
</template>
