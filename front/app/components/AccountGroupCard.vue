<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Account } from '@mint/shared/types/accounts'
import type {
  AccountGroupCardEmits,
  AccountGroupCardProps,
} from '~~/types/components'
import type { AccountActionKind } from '~~/types/referentials'

const props = defineProps<AccountGroupCardProps>()
const emit = defineEmits<AccountGroupCardEmits>()

const { t } = useI18n()

const list = useTemplateRef<HTMLElement>('list')
const sortableScope = 'account'
const { move } = useSortableList(list, {
  scope: sortableScope,
  ids: () => props.group.accounts.map((account) => account.id),
  onReorder: (accountIds) => emit('reorder', accountIds),
})

function methodsOf(account: Account) {
  return props.paymentMethods.filter(
    (paymentMethod) => paymentMethod.accountId === account.id,
  )
}

function isExpanded(account: Account): boolean {
  return props.expandedIds.includes(account.id)
}

function details(account: Account): string {
  const nature = t(`accounts.natures.${account.nature}`)
  const activeMethods = methodsOf(account).filter(
    (paymentMethod) => paymentMethod.archivedAt === null,
  ).length
  return [
    account.regulatedProduct === null
      ? nature
      : t('accounts.natureWithProduct', {
          nature,
          product: t(`accounts.products.${account.regulatedProduct}`),
        }),
    account.institution,
    t('paymentMethods.count', activeMethods),
  ]
    .filter((part) => part !== null)
    .join(' · ')
}

function actionItems(account: Account): DropdownMenuItem[][] {
  const select = (kind: AccountActionKind) =>
    emit('accountAction', { kind, account })
  return [
    [
      {
        label: t('common.edit'),
        icon: icons.edit,
        onSelect: () => select('edit'),
      },
      {
        label: t('paymentMethods.add'),
        icon: icons.add,
        onSelect: () => select('addPaymentMethod'),
      },
      {
        label: t('statements.menu'),
        icon: icons.adjustment,
        onSelect: () => select('statements'),
      },
      ...(account.investment === null
        ? []
        : [
            {
              label: t('valuations.menu'),
              icon: icons.usageInvestment,
              onSelect: () => select('valuations'),
            },
          ]),
      {
        label: t('common.archive'),
        icon: icons.archive,
        onSelect: () => select('archive'),
      },
    ],
    [
      {
        label: t('common.delete'),
        icon: icons.delete,
        color: 'error',
        onSelect: () => select('delete'),
      },
    ],
  ]
}
</script>

<template>
  <UCard
    :ui="{ body: 'p-0 sm:p-0' }"
    :data-testid="`usage-group-${group.usage}`"
  >
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <h2
          class="flex min-w-0 items-center gap-2 text-base font-semibold text-default"
        >
          <DataDot :tone="group.usage" />
          <span class="truncate">{{
            t(`accounts.usages.${group.usage}`)
          }}</span>
        </h2>
        <MoneyAmount
          :cents="group.subtotalCents"
          class="text-base font-semibold"
          data-testid="usage-subtotal"
        />
      </div>
    </template>
    <ul ref="list" class="divide-y divide-default">
      <li
        v-for="(account, index) in group.accounts"
        :key="account.id"
        :data-sortable-item="sortableScope"
        :data-testid="`account-${account.id}`"
        class="px-2 sm:px-4"
      >
        <div class="flex items-center gap-2 py-2">
          <span
            v-if="reordering"
            :data-drag-handle="sortableScope"
            class="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted max-lg:size-11"
            aria-hidden="true"
          >
            <UIcon :name="icons.dragHandle" class="size-5" />
          </span>
          <UButton
            v-else
            :icon="isExpanded(account) ? icons.collapse : icons.expand"
            :aria-expanded="isExpanded(account)"
            :aria-label="t('paymentMethods.toggle', { name: account.name })"
            :class="touchIconButtonClass"
            color="neutral"
            variant="ghost"
            square
            data-testid="account-toggle"
            @click="emit('toggle', account.id)"
          />
          <div class="min-w-0 flex-1">
            <p
              class="truncate text-sm font-medium text-highlighted"
              data-testid="account-name"
            >
              {{ account.name }}
            </p>
            <p class="truncate text-xs text-muted">{{ details(account) }}</p>
          </div>
          <UBadge
            v-if="
              account.reconciliationGapCents !== null &&
              account.reconciliationGapCents !== 0
            "
            :label="t('statements.unresolved')"
            :icon="icons.belowThreshold"
            color="warning"
            variant="soft"
            size="sm"
            data-testid="account-gap"
          />
          <div class="flex flex-col items-end">
            <MoneyAmount
              :cents="account.currentBalanceCents"
              :threshold="account.lowBalanceThresholdCents"
              class="text-sm font-semibold"
              data-testid="account-balance"
            />
            <InvestmentGain
              v-if="account.investment !== null"
              :summary="account.investment"
            />
          </div>
          <template v-if="reordering">
            <UButton
              :icon="icons.moveUp"
              :aria-label="t('common.moveUp', { name: account.name })"
              :disabled="index === 0"
              :class="touchIconButtonClass"
              color="neutral"
              variant="ghost"
              square
              data-testid="move-up"
              @click="move(index, -1)"
            />
            <UButton
              :icon="icons.moveDown"
              :aria-label="t('common.moveDown', { name: account.name })"
              :disabled="index === group.accounts.length - 1"
              :class="touchIconButtonClass"
              color="neutral"
              variant="ghost"
              square
              data-testid="move-down"
              @click="move(index, 1)"
            />
          </template>
          <UDropdownMenu
            v-else
            :items="actionItems(account)"
            :content="{ align: 'end' }"
          >
            <UButton
              :icon="icons.rowActions"
              :aria-label="t('common.actionsFor', { name: account.name })"
              :class="touchIconButtonClass"
              color="neutral"
              variant="ghost"
              square
              data-testid="account-actions"
            />
          </UDropdownMenu>
        </div>
        <PaymentMethodList
          v-if="isExpanded(account) && !reordering"
          :account="account"
          :payment-methods="methodsOf(account)"
          @account-action="emit('accountAction', $event)"
          @payment-method-action="emit('paymentMethodAction', $event)"
        />
      </li>
    </ul>
  </UCard>
</template>
