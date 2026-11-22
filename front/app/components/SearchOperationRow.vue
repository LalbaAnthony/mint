<script setup lang="ts">
import type { SearchOperationRowProps } from '~~/types/search'

const props = defineProps<SearchOperationRowProps>()

const { t } = useI18n()
const connectivity = useConnectivityStore()
const results = useSearchResults()
</script>

<template>
  <li>
    <button
      type="button"
      class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted sm:px-6"
      :disabled="connectivity.offline"
      :data-testid="`search-operation-${operation.id}`"
      @click="results.open({ kind: 'operation', operation: props.operation })"
    >
      <UIcon
        :name="originIcon(operation)"
        class="size-4 shrink-0 text-muted"
        :aria-label="t(`operations.origins.${operation.origin}`)"
      />
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-2 text-sm text-default">
          <span class="truncate">{{ operation.label }}</span>
          <OperationBadges :operation="operation" />
        </p>
        <p class="truncate text-xs text-muted">
          {{ results.operationDetail(operation) }}
        </p>
        <TagBadges :tag-ids="operation.tagIds" class="mt-1" />
      </div>
      <MoneyAmount
        :cents="operation.amountCents"
        variant="flow"
        class="text-sm font-medium"
      />
    </button>
  </li>
</template>
