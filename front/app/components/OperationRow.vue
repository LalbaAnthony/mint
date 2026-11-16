<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { OperationRowEmits, OperationRowProps } from '~~/types/planning'

const props = withDefaults(defineProps<OperationRowProps>(), {
  selected: false,
})
const emit = defineEmits<OperationRowEmits>()

const { t } = useI18n()
const connectivity = useConnectivityStore()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()

const detail = computed(() => {
  const operation = props.operation
  if (operation.transferGroupId !== null) {
    return t('operations.transferWith', {
      account: referentials.accountName(operation.counterpartAccountId),
    })
  }
  return operation.categoryId === null
    ? ''
    : referentials.categoryName(operation.categoryId)
})

const actions = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('common.edit'),
      icon: icons.edit,
      disabled: connectivity.offline,
      onSelect: () => emit('edit', props.operation),
    },
  ],
  [
    {
      label: t('common.delete'),
      icon: icons.delete,
      color: 'error',
      disabled: connectivity.offline,
      onSelect: () => emit('delete', props.operation),
    },
  ],
])
</script>

<template>
  <li
    class="flex items-center gap-3 py-2"
    :data-testid="`operation-${operation.id}`"
  >
    <UCheckbox
      :model-value="selected"
      :disabled="connectivity.offline"
      :aria-label="
        t('rules.reapply.selectOperation', { label: operation.label })
      "
      data-testid="operation-select"
      @update:model-value="emit('toggle', operation)"
    />
    <button
      type="button"
      class="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left"
      :disabled="connectivity.offline"
      :title="connectivity.offline ? t('offline.writeDisabled') : undefined"
      @click="emit('edit', operation)"
    >
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-1 truncate text-sm text-default">
          <UIcon
            :name="originIcon(operation)"
            class="size-4 shrink-0 text-muted"
            :aria-label="t(`operations.origins.${operation.origin}`)"
          />
          <span class="truncate">{{ operation.label }}</span>
        </p>
        <p class="flex items-center gap-2 truncate text-xs text-muted">
          <span class="tabular-nums">{{ formatDate(operation.date) }}</span>
          <span v-if="detail !== ''" class="truncate">{{ detail }}</span>
          <OperationBadges :operation="operation" />
        </p>
        <TagBadges :tag-ids="operation.tagIds" class="mt-1" />
      </div>
      <MoneyAmount
        :cents="operation.amountCents"
        variant="flow"
        class="text-sm font-medium"
      />
    </button>
    <UDropdownMenu :items="actions">
      <UButton
        :icon="icons.rowActions"
        :aria-label="t('common.actionsFor', { name: operation.label })"
        color="neutral"
        variant="ghost"
        class="size-11 justify-center lg:size-auto"
      />
    </UDropdownMenu>
  </li>
</template>
