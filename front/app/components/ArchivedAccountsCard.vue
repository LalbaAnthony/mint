<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Account } from '@mint/shared/types/accounts'
import type {
  ArchivedAccountsCardEmits,
  ArchivedAccountsCardProps,
} from '~~/types/components'

defineProps<ArchivedAccountsCardProps>()
const emit = defineEmits<ArchivedAccountsCardEmits>()

const { t } = useI18n()
const connectivity = useConnectivityStore()

const open = ref(false)

function actionItems(account: Account): DropdownMenuItem[][] {
  return [
    [
      {
        label: t('common.restore'),
        icon: icons.restore,
        disabled: connectivity.offline,
        onSelect: () => emit('accountAction', { kind: 'restore', account }),
      },
    ],
    [
      {
        label: t('common.delete'),
        icon: icons.delete,
        color: 'error',
        disabled: connectivity.offline,
        onSelect: () => emit('accountAction', { kind: 'delete', account }),
      },
    ],
  ]
}
</script>

<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }" data-testid="archived-accounts">
    <UCollapsible v-model:open="open">
      <UButton
        :label="t('accounts.archivedSection', { n: accounts.length })"
        :trailing-icon="open ? icons.collapse : icons.expand"
        color="neutral"
        variant="ghost"
        block
        class="justify-between px-4 py-3 text-base font-semibold sm:px-6"
        data-testid="archived-accounts-toggle"
      />
      <template #content>
        <ul class="divide-y divide-default border-t border-default">
          <li
            v-for="account in accounts"
            :key="account.id"
            class="flex items-center gap-2 px-4 py-2 sm:px-6"
            :data-testid="`archived-account-${account.id}`"
          >
            <div class="flex min-w-0 flex-1 items-center gap-2">
              <span class="truncate text-sm text-muted">{{
                account.name
              }}</span>
              <UBadge
                :label="t('common.archived')"
                color="neutral"
                variant="soft"
              />
            </div>
            <MoneyAmount
              :cents="account.currentBalanceCents"
              concealable
              class="text-sm font-semibold"
            />
            <UDropdownMenu
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
                data-testid="archived-account-actions"
              />
            </UDropdownMenu>
          </li>
        </ul>
      </template>
    </UCollapsible>
  </UCard>
</template>
