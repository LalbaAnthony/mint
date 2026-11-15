<script setup lang="ts">
import {
  ruleMatchTypes,
  ruleSchema,
  ruleSigns,
} from '@mint/shared/schemas/rules'
import type { CreateRuleRequest } from '@mint/shared/types/rules'
import { ruleFormSchema } from '~~/schemas/forms'
import type { SelectItem } from '~~/types/forms'
import type {
  RuleActionKind,
  RuleFormModalEmits,
  RuleFormModalProps,
  RuleFormState,
} from '~~/types/rules'

const props = defineProps<RuleFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<RuleFormModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const referentials = useReferentialsStore()

const anyAccount = 'any'
const saving = ref(false)

function emptyState(): RuleFormState {
  return {
    matchType: 'contains',
    pattern: '',
    accountId: anyAccount,
    sign: 'any',
    amountMin: '',
    amountMax: '',
    action: 'category',
    categoryId: undefined,
    transferAccountId: undefined,
    tagIds: [],
    active: true,
  }
}

const state = reactive<RuleFormState>(emptyState())

watch(
  open,
  (isOpen) => {
    if (!isOpen) {
      return
    }
    const source = props.rule ?? props.draft
    Object.assign(state, emptyState())
    if (source === null) {
      return
    }
    Object.assign(state, {
      matchType: source.matchType,
      pattern: source.pattern,
      accountId: source.accountId ?? anyAccount,
      sign: source.sign,
      action: source.transferAccountId === null ? 'category' : 'transfer',
      categoryId: source.categoryId ?? undefined,
      transferAccountId: source.transferAccountId ?? undefined,
      tagIds: [...source.tagIds],
    })
    if (props.rule !== null) {
      Object.assign(state, {
        amountMin:
          props.rule.amountMinCents === null
            ? ''
            : formatAmountInput(props.rule.amountMinCents, locale.value),
        amountMax:
          props.rule.amountMaxCents === null
            ? ''
            : formatAmountInput(props.rule.amountMaxCents, locale.value),
        active: props.rule.active,
      })
    }
  },
  { immediate: true },
)

const matchItems = computed<SelectItem<CreateRuleRequest['matchType']>[]>(() =>
  ruleMatchTypes.map((type) => ({
    label: t(`rules.matchTypes.${type}`),
    value: type,
  })),
)

const signItems = computed<SelectItem<CreateRuleRequest['sign']>[]>(() =>
  ruleSigns.map((sign) => ({ label: t(`rules.signs.${sign}`), value: sign })),
)

const accountItems = computed<SelectItem<string>[]>(() => [
  { label: t('rules.anyAccount'), value: anyAccount },
  ...referentials.activeAccounts.map((account) => ({
    label: account.name,
    value: account.id,
  })),
])

const actionItems = computed<SelectItem<RuleActionKind>[]>(() => [
  { label: t('rules.actions.category'), value: 'category' },
  { label: t('rules.actions.transfer'), value: 'transfer' },
])

const categoryItems = computed<SelectItem<string>[]>(() =>
  categoryOptionGroups(
    referentials.categories,
    ['expense', 'income'],
    state.categoryId,
    (kind) => t(`categories.kinds.${kind}`),
  ).flatMap((group) => group.options),
)

const transferItems = computed<SelectItem<string>[]>(() =>
  referentials.activeAccounts
    .filter((account) => account.id !== state.accountId)
    .map((account) => ({ label: account.name, value: account.id })),
)

function centsOf(text: string): number | null {
  const cents = parseAmountInput(text)
  return cents === null ? null : Math.abs(cents)
}

async function submit(): Promise<void> {
  if (!ruleFormSchema.safeParse(state).success) {
    return
  }
  const body: CreateRuleRequest = {
    matchType: state.matchType,
    pattern: state.pattern.trim(),
    accountId: state.accountId === anyAccount ? null : state.accountId,
    sign: state.sign,
    amountMinCents:
      state.amountMin.trim() === '' ? null : centsOf(state.amountMin),
    amountMaxCents:
      state.amountMax.trim() === '' ? null : centsOf(state.amountMax),
    categoryId: state.action === 'category' ? (state.categoryId ?? null) : null,
    transferAccountId:
      state.action === 'transfer' ? (state.transferAccountId ?? null) : null,
    tagIds: state.tagIds,
    active: state.active,
  }
  saving.value = true
  try {
    const saved =
      props.rule === null
        ? await apiCall('POST', '/rules', ruleSchema, body)
        : await apiCall('PATCH', `/rules/${props.rule.id}`, ruleSchema, body)
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
    :title="rule === null ? t('rules.createTitle') : t('rules.editTitle')"
  >
    <template #body>
      <UForm
        :state="state"
        :validate="validator(ruleFormSchema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="rule-form"
        @submit="submit"
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <AppFormField :label="t('rules.fields.matchType')" name="matchType">
            <USelect
              v-model="state.matchType"
              :items="matchItems"
              class="w-full"
              data-testid="rule-match-type"
            />
          </AppFormField>
          <AppFormField
            :label="t('rules.fields.pattern')"
            name="pattern"
            class="sm:col-span-2"
          >
            <UInput
              v-model="state.pattern"
              class="w-full"
              data-testid="rule-pattern"
            />
          </AppFormField>
        </div>
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <AppFormField :label="t('rules.fields.account')" name="accountId">
            <USelect
              v-model="state.accountId"
              :items="accountItems"
              class="w-full"
            />
          </AppFormField>
          <AppFormField :label="t('rules.fields.sign')" name="sign">
            <USelect v-model="state.sign" :items="signItems" class="w-full" />
          </AppFormField>
          <AppFormField
            :label="t('rules.fields.amountMin')"
            :hint="t('common.optional')"
            name="amountMin"
          >
            <UInput
              v-model="state.amountMin"
              inputmode="decimal"
              class="w-full text-right tabular-nums"
            />
          </AppFormField>
          <AppFormField
            :label="t('rules.fields.amountMax')"
            :hint="t('common.optional')"
            name="amountMax"
          >
            <UInput
              v-model="state.amountMax"
              inputmode="decimal"
              class="w-full text-right tabular-nums"
            />
          </AppFormField>
        </div>
        <URadioGroup
          v-model="state.action"
          :items="actionItems"
          orientation="horizontal"
          variant="table"
          :legend="t('rules.fields.action')"
        />
        <AppFormField
          v-if="state.action === 'category'"
          :label="t('operations.fields.category')"
          name="categoryId"
        >
          <USelect
            v-model="state.categoryId"
            :items="categoryItems"
            class="w-full"
            data-testid="rule-category"
          />
        </AppFormField>
        <AppFormField
          v-else
          :label="t('rules.fields.transferAccount')"
          name="transferAccountId"
        >
          <USelect
            v-model="state.transferAccountId"
            :items="transferItems"
            class="w-full"
            data-testid="rule-transfer-account"
          />
        </AppFormField>
        <AppFormField
          :label="t('rules.fields.tags')"
          :hint="t('rules.fields.tagsHint')"
          name="tagIds"
        >
          <TagSelect v-model="state.tagIds" test-id="rule-tags" />
        </AppFormField>
        <USwitch v-model="state.active" :label="t('rules.fields.active')" />
        <UButton
          type="submit"
          :label="t('common.save')"
          :loading="saving"
          color="primary"
          variant="solid"
          block
          data-testid="rule-submit"
        />
      </UForm>
    </template>
  </UModal>
</template>
