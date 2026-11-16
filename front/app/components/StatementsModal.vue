<script setup lang="ts">
import {
  statementListResponseSchema,
  statementSchema,
} from '@mint/shared/schemas/statements'
import type { Statement } from '@mint/shared/types/statements'
import { statementFormSchema } from '~~/schemas/forms'
import type {
  StatementFormState,
  StatementsModalEmits,
  StatementsModalProps,
} from '~~/types/statements'

const props = defineProps<StatementsModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<StatementsModalEmits>()

const { t } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const { formatDate, formatMoney } = useFormatters()

const statements = ref<Statement[]>([])
const busy = ref(false)
const state = reactive<StatementFormState>({
  date: parisDate(new Date()),
  balance: '',
})

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function load(): Promise<void> {
  const account = props.account
  if (account === null) {
    statements.value = []
    return
  }
  try {
    statements.value = (
      await apiGet(
        `/accounts/${account.id}/statements`,
        statementListResponseSchema,
      )
    ).statements
  } catch (error) {
    notifyFailure(error)
  }
}

watch(
  [open, () => props.account?.id],
  async ([isOpen]) => {
    if (isOpen) {
      state.date = parisDate(new Date())
      state.balance = ''
      await load()
    }
  },
  { immediate: true },
)

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  try {
    await action()
    await load()
    emit('changed')
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

function record(): Promise<void> {
  const account = props.account
  const balance = parseAmountInput(state.balance)
  if (
    account === null ||
    balance === null ||
    !statementFormSchema.safeParse(state).success
  ) {
    return Promise.resolve()
  }
  return run(() =>
    apiCall('POST', `/accounts/${account.id}/statements`, statementSchema, {
      date: state.date,
      balanceCents: balance,
    }),
  )
}

function adjust(statement: Statement): Promise<void> {
  return run(() =>
    apiCall('POST', `/statements/${statement.id}/adjust`, statementSchema),
  )
}

function remove(statement: Statement): Promise<void> {
  return run(() => apiCommand('DELETE', `/statements/${statement.id}`))
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('statements.title', { name: account?.name ?? '' })"
    :description="t('statements.help')"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="statements">
        <UForm
          :state="state"
          :validate="validator(statementFormSchema)"
          :validate-on="['blur']"
          class="flex flex-wrap items-end gap-2"
          data-testid="statement-form"
          @submit="record"
        >
          <AppFormField :label="t('statements.date')" name="date">
            <UInput v-model="state.date" type="date" />
          </AppFormField>
          <AppFormField :label="t('statements.balance')" name="balance">
            <UInput
              v-model="state.balance"
              inputmode="decimal"
              class="text-right tabular-nums"
              data-testid="statement-balance"
            />
          </AppFormField>
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              type="submit"
              :label="t('statements.record')"
              color="primary"
              variant="solid"
              :loading="busy"
              data-testid="statement-submit"
            />
          </OfflineGuard>
        </UForm>
        <p v-if="statements.length === 0" class="text-sm text-muted">
          {{ t('statements.empty') }}
        </p>
        <ul v-else class="flex flex-col divide-y divide-default">
          <li
            v-for="statement in statements"
            :key="statement.id"
            class="flex flex-wrap items-center gap-2 py-2"
            :data-testid="`statement-${statement.date}`"
          >
            <div class="min-w-0 flex-1 text-sm">
              <p class="tabular-nums text-default">
                {{ formatDate(statement.date) }}
              </p>
              <p class="flex flex-wrap gap-2 text-xs text-muted">
                <span>
                  {{ t('statements.read') }}
                  <MoneyAmount :cents="statement.balanceCents" />
                </span>
                <span>
                  {{ t('statements.calculated') }}
                  <MoneyAmount :cents="statement.calculatedBalanceCents" />
                </span>
              </p>
            </div>
            <span
              class="tabular-nums text-sm"
              :class="statement.gapCents === 0 ? 'text-muted' : 'text-warning'"
              data-testid="statement-gap"
            >
              {{ t('statements.gap') }}
              {{ formatMoney(statement.gapCents, 'exceptZero') }}
            </span>
            <OfflineGuard v-if="statement.gapCents !== 0" v-slot="{ offline }">
              <UButton
                :disabled="offline"
                :label="t('statements.adjust')"
                :icon="icons.adjustment"
                color="primary"
                variant="soft"
                size="sm"
                :loading="busy"
                data-testid="statement-adjust"
                @click="adjust(statement)"
              />
            </OfflineGuard>
            <OfflineGuard v-slot="{ offline }">
              <UButton
                :icon="icons.delete"
                :aria-label="t('statements.delete')"
                color="error"
                variant="ghost"
                size="sm"
                :disabled="offline || busy"
                @click="remove(statement)"
              />
            </OfflineGuard>
          </li>
        </ul>
      </div>
    </template>
  </UModal>
</template>
