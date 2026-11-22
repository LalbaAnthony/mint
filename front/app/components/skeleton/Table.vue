<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { SkeletonTableProps, SkeletonTableRow } from '~~/types/skeleton'

const props = withDefaults(defineProps<SkeletonTableProps>(), {
  count: skeletonRowCount,
})

const rows = computed<SkeletonTableRow[]>(() =>
  skeletonIndexes(props.count).map((index) => ({ index })),
)

const tableColumns = computed<TableColumn<SkeletonTableRow>[]>(() =>
  props.columns.map((column) => ({ id: column.id, header: column.header })),
)
</script>

<template>
  <UTable
    :data="rows"
    :columns="tableColumns"
    aria-hidden="true"
    data-testid="skeleton-table"
  >
    <template
      v-for="column in columns"
      #[`${column.id}-cell`]="{ row }"
      :key="column.id"
    >
      <SkeletonControl v-if="column.cell === 'checkbox'" kind="checkbox" />
      <div v-else-if="column.cell === 'actions'" class="flex justify-end">
        <SkeletonControl kind="icon-button" />
      </div>
      <div v-else-if="column.cell === 'amount'" class="text-right">
        <SkeletonAmount :concealable="column.concealable ?? false" />
      </div>
      <div v-else-if="column.cell === 'text-detail'" class="flex flex-col">
        <SkeletonText :width="skeletonRowWidth(row.index)" />
        <SkeletonText width="sm" class="text-xs" />
      </div>
      <SkeletonProgress v-else-if="column.cell === 'progress'" />
      <SkeletonText v-else-if="column.cell === 'date'" width="sm" />
      <SkeletonText v-else-if="column.cell === 'text'" width="md" />
    </template>
    <template v-if="$slots['body-bottom']" #body-bottom>
      <slot name="body-bottom" />
    </template>
  </UTable>
</template>
