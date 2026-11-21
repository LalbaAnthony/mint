<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import {
  accountNatures,
  accountSchema,
  accountUsages,
  isSavingsNature,
  productsForNature,
  regulatedCapListResponseSchema,
} from '@mint/shared/schemas/accounts'
import { capitalizations, interestMethods } from '@mint/shared/schemas/interest'
import type {
  Capitalization,
  InterestMethod,
} from '@mint/shared/types/interest'
import type {
  Account,
  AccountNature,
  AccountUsage,
  CreateAccountRequest,
  RegulatedCap,
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
    depositCap: '',
    capitalizedInterest: '',
    interestMethod: 'fortnight',
    capitalization: 'dec31',
    anniversaryDate: '',
  }
}

function centsInput(cents: number | null): string {
  return cents === null ? '' : formatAmountInput(cents, locale.value)
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
    depositCap: centsInput(account.depositCapCents),
    capitalizedInterest: centsInput(account.capitalizedInterestCents),
    interestMethod: account.interestMethod ?? 'fortnight',
    capitalization: account.capitalization ?? 'dec31',
    anniversaryDate: account.anniversaryDate ?? '',
  }
}

const state = reactive<AccountFormState>(emptyState())
const referenceCaps = ref<RegulatedCap[]>([])

async function loadReferenceCaps(): Promise<void> {
  try {
    referenceCaps.value = await apiGet(
      '/regulated-caps',
      regulatedCapListResponseSchema,
    )
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  }
}

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
  () => state.regulatedProduct,
  async (product, previous) => {
    if (
      product === previous ||
      product === null ||
      product === (props.account?.regulatedProduct ?? null)
    ) {
      return
    }
    if (referenceCaps.value.length === 0) {
      await loadReferenceCaps()
    }
    const reference = referenceCaps.value.find((cap) => cap.product === product)
    if (reference !== undefined) {
      state.depositCap = formatAmountInput(reference.capCents, locale.value)
    }
  },
)

const isSavings = computed(() => isSavingsNature(state.nature))

const methodItems = computed<SelectItem<InterestMethod>[]>(() =>
  interestMethods.map((method) => ({
    label: t(`accounts.interestMethods.${method}`),
    value: method,
  })),
)

const capitalizationItems = computed<SelectItem<Capitalization>[]>(() =>
  capitalizations.map((capitalization) => ({
    label: t(`accounts.capitalizations.${capitalization}`),
    value: capitalization,
  })),
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

const schema = computed(() => accountFormSchema(today.value, locale.value))

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
    ...(isSavingsNature(parsed.data.nature)
      ? {
          depositCapCents: parsed.data.depositCap,
          capitalizedInterestCents: parsed.data.capitalizedInterest ?? 0,
          interestMethod: parsed.data.interestMethod,
          capitalization: parsed.data.capitalization,
          anniversaryDate:
            parsed.data.capitalization === 'anniversary'
              ? parsed.data.anniversaryDate
              : null,
        }
      : {}),
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
      <AppForm
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
            <AmountInput
              v-model="state.initialBalance"
              data-testid="account-initial-balance"
            />
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
          <AmountInput
            v-model="state.lowBalanceThreshold"
            data-testid="account-threshold"
          />
        </AppFormField>
        <template v-if="isSavings">
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AppFormField
              :label="t('accounts.fields.depositCap')"
              :hint="t('accounts.fields.depositCapHint')"
              name="depositCap"
            >
              <AmountInput
                v-model="state.depositCap"
                data-testid="account-deposit-cap"
              />
            </AppFormField>
            <AppFormField
              :label="t('accounts.fields.capitalizedInterest')"
              :hint="t('accounts.fields.capitalizedInterestHint')"
              name="capitalizedInterest"
            >
              <AmountInput
                v-model="state.capitalizedInterest"
                data-testid="account-capitalized-interest"
              />
            </AppFormField>
          </div>
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <AppFormField
              :label="t('accounts.fields.interestMethod')"
              name="interestMethod"
            >
              <USelect
                v-model="state.interestMethod"
                :items="methodItems"
                class="w-full"
                data-testid="account-interest-method"
              />
            </AppFormField>
            <AppFormField
              :label="t('accounts.fields.capitalization')"
              name="capitalization"
            >
              <USelect
                v-model="state.capitalization"
                :items="capitalizationItems"
                class="w-full"
                data-testid="account-capitalization"
              />
            </AppFormField>
          </div>
          <AppFormField
            v-if="state.capitalization === 'anniversary'"
            :label="t('accounts.fields.anniversaryDate')"
            name="anniversaryDate"
          >
            <UInput
              v-model="state.anniversaryDate"
              type="date"
              class="w-full"
              :ui="{ base: 'tabular-nums' }"
              data-testid="account-anniversary-date"
            />
          </AppFormField>
        </template>
        <OfflineGuard block v-slot="{ offline }">
          <UButton
            :disabled="offline"
            type="submit"
            :label="t('common.save')"
            :loading="saving"
            color="primary"
            variant="solid"
            block
            data-testid="account-submit"
          />
        </OfflineGuard>
      </AppForm>
    </template>
  </UModal>
</template>
