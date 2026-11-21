<script setup lang="ts">
import {
  accountOverviewSchema,
  accountSchema,
} from '@mint/shared/schemas/accounts'
import {
  paymentMethodListResponseSchema,
  paymentMethodSchema,
} from '@mint/shared/schemas/payment-methods'
import type { Account, AccountOverview } from '@mint/shared/types/accounts'
import type { UsageCounts } from '@mint/shared/types/operations'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import type { AccountAction, PaymentMethodAction } from '~~/types/referentials'

const { t } = useI18n()
const toast = useToast()
const session = useSessionStore()
const { errorMessage } = useFormValidation()
const { loadUsage, accountNotice, paymentMethodNotice } = useUsageNotice()

const overview = ref<AccountOverview | null>(null)
const paymentMethods = ref<PaymentMethod[]>([])
const reordering = ref(false)
const expandedIds = ref<string[]>([])
const busy = ref(false)

const activeAccounts = computed(
  () => overview.value?.groups.flatMap((group) => group.accounts) ?? [],
)
const hasActiveAccounts = computed(() => activeAccounts.value.length > 0)

function notify(title: string): void {
  toast.add({ title, icon: icons.success, color: 'success' })
}

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function load(): Promise<void> {
  try {
    const [loadedOverview, loadedPaymentMethods] = await Promise.all([
      apiGet('/accounts/overview', accountOverviewSchema),
      apiGet('/payment-methods', paymentMethodListResponseSchema),
    ])
    overview.value = loadedOverview
    paymentMethods.value = loadedPaymentMethods
  } catch (error) {
    notifyFailure(error)
  }
}

async function run(action: () => Promise<void>): Promise<void> {
  busy.value = true
  try {
    await action()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
    await load()
  }
}

function toggle(accountId: string): void {
  expandedIds.value = expandedIds.value.includes(accountId)
    ? expandedIds.value.filter((id) => id !== accountId)
    : [...expandedIds.value, accountId]
}

const accountFormOpen = ref(false)
const editedAccount = ref<Account | null>(null)

function openAccountForm(account: Account | null): void {
  editedAccount.value = account
  accountFormOpen.value = true
}

async function refreshDefaultAccount(): Promise<void> {
  try {
    await session.refresh()
  } catch (error) {
    notifyFailure(error)
  }
}

async function accountSaved(account: Account): Promise<void> {
  const created = editedAccount.value === null
  notify(t('accounts.saved', { name: account.name }))
  await load()
  if (created) {
    await refreshDefaultAccount()
  }
}

const paymentMethodFormOpen = ref(false)
const editedPaymentMethod = ref<PaymentMethod | null>(null)
const paymentMethodAccountId = ref<string | null>(null)

function openPaymentMethodForm(
  paymentMethod: PaymentMethod | null,
  accountId: string | null,
): void {
  editedPaymentMethod.value = paymentMethod
  paymentMethodAccountId.value = accountId
  paymentMethodFormOpen.value = true
}

async function paymentMethodSaved(paymentMethod: PaymentMethod): Promise<void> {
  notify(t('paymentMethods.saved', { label: paymentMethod.label }))
  if (!expandedIds.value.includes(paymentMethod.accountId)) {
    expandedIds.value = [...expandedIds.value, paymentMethod.accountId]
  }
  await load()
}

function activeMethodCount(account: Account): number {
  return paymentMethods.value.filter(
    (paymentMethod) =>
      paymentMethod.accountId === account.id &&
      paymentMethod.archivedAt === null,
  ).length
}

function methodCount(account: Account): number {
  return paymentMethods.value.filter(
    (paymentMethod) => paymentMethod.accountId === account.id,
  ).length
}

const accountToDelete = ref<Account | null>(null)
const accountUsage = ref<UsageCounts | null>(null)
const deleteAccountOpen = computed({
  get: () => accountToDelete.value !== null,
  set: (open) => {
    if (!open) {
      accountToDelete.value = null
    }
  },
})

const accountDeletion = computed(() => {
  const account = accountToDelete.value
  if (account === null) {
    return { blocked: true, description: '' }
  }
  const count = methodCount(account)
  return accountNotice(
    accountUsage.value,
    account.name,
    t('accounts.deleteEffect', { name: account.name, n: count }, count),
  )
})

async function askAccountDeletion(account: Account): Promise<void> {
  accountUsage.value = null
  accountToDelete.value = account
  try {
    accountUsage.value = await loadUsage(`/accounts/${account.id}`)
  } catch (error) {
    notifyFailure(error)
  }
}

function deleteAccount(): Promise<void> {
  const account = accountToDelete.value
  if (account === null) {
    return Promise.resolve()
  }
  return run(async () => {
    await apiCommand('DELETE', `/accounts/${account.id}`)
    accountToDelete.value = null
    notify(t('accounts.deleted', { name: account.name }))
    await refreshDefaultAccount()
  })
}

const statementAccount = ref<Account | null>(null)
const statementsOpen = computed({
  get: () => statementAccount.value !== null,
  set: (open) => {
    if (!open) {
      statementAccount.value = null
    }
  },
})

const interestAccount = ref<Account | null>(null)
const interestOpen = computed({
  get: () => interestAccount.value !== null,
  set: (open) => {
    if (!open) {
      interestAccount.value = null
    }
  },
})

const valuationAccount = ref<Account | null>(null)
const valuationsOpen = computed({
  get: () => valuationAccount.value !== null,
  set: (open) => {
    if (!open) {
      valuationAccount.value = null
    }
  },
})

function onAccountAction({ kind, account }: AccountAction): Promise<void> {
  switch (kind) {
    case 'edit':
      openAccountForm(account)
      return Promise.resolve()
    case 'addPaymentMethod':
      openPaymentMethodForm(null, account.id)
      return Promise.resolve()
    case 'statements':
      statementAccount.value = account
      return Promise.resolve()
    case 'valuations':
      valuationAccount.value = account
      return Promise.resolve()
    case 'interest':
      interestAccount.value = account
      return Promise.resolve()
    case 'delete':
      return askAccountDeletion(account)
    case 'archive':
      return run(async () => {
        const count = activeMethodCount(account)
        await apiCall('POST', `/accounts/${account.id}/archive`, accountSchema)
        notify(
          t('accounts.archivedNotice', { name: account.name, n: count }, count),
        )
        await refreshDefaultAccount()
      })
    case 'restore':
      return run(async () => {
        await apiCall('POST', `/accounts/${account.id}/restore`, accountSchema)
        notify(t('accounts.restoredNotice', { name: account.name }))
      })
  }
}

const paymentMethodToDelete = ref<PaymentMethod | null>(null)
const paymentMethodUsage = ref<UsageCounts | null>(null)
const deletePaymentMethodOpen = computed({
  get: () => paymentMethodToDelete.value !== null,
  set: (open) => {
    if (!open) {
      paymentMethodToDelete.value = null
    }
  },
})

const paymentMethodDeletion = computed(() =>
  paymentMethodNotice(
    paymentMethodUsage.value,
    paymentMethodToDelete.value?.label ?? '',
  ),
)

async function askPaymentMethodDeletion(
  paymentMethod: PaymentMethod,
): Promise<void> {
  paymentMethodUsage.value = null
  paymentMethodToDelete.value = paymentMethod
  try {
    paymentMethodUsage.value = await loadUsage(
      `/payment-methods/${paymentMethod.id}`,
    )
  } catch (error) {
    notifyFailure(error)
  }
}

function deletePaymentMethod(): Promise<void> {
  const paymentMethod = paymentMethodToDelete.value
  if (paymentMethod === null) {
    return Promise.resolve()
  }
  return run(async () => {
    await apiCommand('DELETE', `/payment-methods/${paymentMethod.id}`)
    paymentMethodToDelete.value = null
  })
}

function onPaymentMethodAction({
  kind,
  paymentMethod,
}: PaymentMethodAction): Promise<void> {
  switch (kind) {
    case 'edit':
      openPaymentMethodForm(paymentMethod, null)
      return Promise.resolve()
    case 'delete':
      return askPaymentMethodDeletion(paymentMethod)
    case 'archive':
      return run(async () => {
        await apiCall(
          'POST',
          `/payment-methods/${paymentMethod.id}/archive`,
          paymentMethodSchema,
        )
      })
    case 'restore':
      return run(async () => {
        await apiCall(
          'POST',
          `/payment-methods/${paymentMethod.id}/restore`,
          paymentMethodSchema,
        )
      })
  }
}

function reorder(usageIndex: number, accountIds: string[]): Promise<void> {
  const current = overview.value
  const group = current?.groups[usageIndex]
  if (current === null || group === undefined) {
    return Promise.resolve()
  }
  const byId = new Map(group.accounts.map((account) => [account.id, account]))
  const accounts = accountIds.flatMap((id) => {
    const account = byId.get(id)
    return account === undefined ? [] : [account]
  })
  overview.value = {
    ...current,
    groups: current.groups.map((candidate, index) =>
      index === usageIndex ? { ...candidate, accounts } : candidate,
    ),
  }
  return run(async () => {
    await apiCommand('POST', '/accounts/reorder', {
      usage: group.usage,
      accountIds,
    })
  })
}

onMounted(load)
</script>

<template>
  <ViewPanel :title="t('navigation.accounts')">
    <template #actions>
      <OfflineGuard v-if="hasActiveAccounts" v-slot="{ offline }">
        <UButton
          :disabled="offline"
          :icon="reordering ? icons.success : icons.reorder"
          :aria-label="
            reordering ? t('common.doneReordering') : t('common.reorder')
          "
          :aria-pressed="reordering"
          color="primary"
          variant="soft"
          data-testid="accounts-reorder"
          @click="reordering = !reordering"
        >
          <span class="max-sm:sr-only">
            {{ reordering ? t('common.doneReordering') : t('common.reorder') }}
          </span>
        </UButton>
      </OfflineGuard>
      <OfflineGuard v-slot="{ offline }">
        <UButton
          :disabled="offline"
          :icon="icons.add"
          :aria-label="t('accounts.add')"
          color="primary"
          variant="soft"
          data-testid="accounts-add"
          @click="openAccountForm(null)"
        >
          <span class="max-sm:sr-only">{{ t('accounts.add') }}</span>
        </UButton>
      </OfflineGuard>
    </template>

    <div v-if="overview !== null" class="flex flex-col gap-6">
      <template v-if="hasActiveAccounts">
        <UCard data-testid="accounts-total">
          <p class="text-sm font-medium text-muted">
            {{ t('accounts.total') }}
          </p>
          <MoneyAmount
            :cents="overview.totalCents"
            concealable
            class="text-3xl font-bold"
          />
        </UCard>
        <AccountGroupCard
          v-for="(group, index) in overview.groups"
          :key="group.usage"
          :group="group"
          :payment-methods="paymentMethods"
          :reordering="reordering"
          :expanded-ids="expandedIds"
          @reorder="reorder(index, $event)"
          @toggle="toggle"
          @account-action="onAccountAction"
          @payment-method-action="onPaymentMethodAction"
        />
      </template>
      <UCard v-else>
        <EmptyState
          :icon="icons.accounts"
          :title="t('accounts.emptyTitle')"
          :description="t('accounts.emptyText')"
        >
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              :label="t('accounts.add')"
              :icon="icons.add"
              color="primary"
              variant="soft"
              @click="openAccountForm(null)"
            />
          </OfflineGuard>
        </EmptyState>
      </UCard>
      <ArchivedAccountsCard
        v-if="overview.archived.length > 0"
        :accounts="overview.archived"
        @account-action="onAccountAction"
      />
    </div>

    <AccountFormModal
      v-model:open="accountFormOpen"
      :account="editedAccount"
      @saved="accountSaved"
    />
    <StatementsModal
      v-model:open="statementsOpen"
      :account="statementAccount"
      @changed="load"
    />
    <ValuationsModal
      v-model:open="valuationsOpen"
      :account="valuationAccount"
      @changed="load"
    />
    <InterestModal
      v-model:open="interestOpen"
      :account="interestAccount"
      @changed="load"
    />

    <PaymentMethodFormModal
      v-model:open="paymentMethodFormOpen"
      :payment-method="editedPaymentMethod"
      :account-id="paymentMethodAccountId"
      :accounts="activeAccounts"
      @saved="paymentMethodSaved"
    />

    <ConfirmModal
      v-model:open="deleteAccountOpen"
      :title="t('accounts.deleteTitle')"
      :description="accountDeletion.description"
      :confirm-label="t('common.delete')"
      :pending="busy"
      :blocked="accountDeletion.blocked"
      @confirm="deleteAccount"
    />

    <ConfirmModal
      v-model:open="deletePaymentMethodOpen"
      :title="t('paymentMethods.deleteTitle')"
      :description="paymentMethodDeletion.description"
      :confirm-label="t('common.delete')"
      :pending="busy"
      :blocked="paymentMethodDeletion.blocked"
      @confirm="deletePaymentMethod"
    />
  </ViewPanel>
</template>
