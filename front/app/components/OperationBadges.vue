<script setup lang="ts">
import type { OperationBadgesProps } from '~~/types/planning'

const props = defineProps<OperationBadgesProps>()

const { t } = useI18n()
const referentials = useReferentialsStore()

const isAdjustment = computed(
  () =>
    props.operation.categoryId !== null &&
    referentials.categories.find(
      (category) => category.id === props.operation.categoryId,
    )?.kind === 'adjustment',
)
</script>

<template>
  <span class="inline-flex flex-wrap items-center gap-1">
    <UBadge
      v-if="operation.status === 'to_categorize'"
      :label="t('operations.statuses.to_categorize')"
      :icon="icons.uncategorized"
      color="secondary"
      variant="solid"
      size="sm"
      data-testid="badge-to-categorize"
    />
    <UBadge
      v-if="isAdjustment"
      :label="t('operations.badges.adjustment')"
      :icon="icons.adjustment"
      color="neutral"
      variant="soft"
      size="sm"
      data-testid="badge-adjustment"
    />
    <UBadge
      v-if="operation.unconfirmed"
      :label="t('operations.badges.unconfirmed')"
      :icon="icons.unconfirmed"
      color="neutral"
      variant="outline"
      size="sm"
      data-testid="badge-unconfirmed"
    />
    <span
      v-if="operation.reconciled"
      role="img"
      :aria-label="t('operations.badges.reconciled')"
      :title="t('operations.badges.reconciled')"
      class="inline-flex"
      data-testid="badge-reconciled"
    >
      <UIcon :name="icons.reconciled" class="size-4 text-muted" />
    </span>
  </span>
</template>
