<script setup lang="ts">
import type { SearchAccountRowProps } from '~~/types/search'

const props = defineProps<SearchAccountRowProps>()

const { t } = useI18n()
const results = useSearchResults()
</script>

<template>
  <li>
    <ListRow
      as="button"
      :gap="3"
      inset
      class="hover:bg-muted"
      :data-testid="`search-account-${account.id}`"
      @click="results.open({ kind: 'account', account: props.account })"
    >
      <UIcon :name="icons.accounts" class="size-4 shrink-0 text-muted" />
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-2 text-sm text-default">
          <span class="truncate">{{ account.name }}</span>
          <UBadge
            v-if="account.archivedAt !== null"
            :label="t('common.archived')"
            color="neutral"
            variant="soft"
            size="sm"
          />
        </p>
        <p class="truncate text-xs text-muted">
          {{ results.accountDetail(account) }}
        </p>
      </div>
      <MoneyAmount
        :cents="account.currentBalanceCents"
        :threshold="account.lowBalanceThresholdCents"
        concealable
        class="text-sm font-semibold"
      />
    </ListRow>
  </li>
</template>
