<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Category } from '@mint/shared/types/categories'
import type { CategoryListEmits, CategoryListProps } from '~~/types/components'
import type { CategoryActionKind } from '~~/types/referentials'

const props = withDefaults(defineProps<CategoryListProps>(), { nested: false })
const emit = defineEmits<CategoryListEmits>()

const { t } = useI18n()
const connectivity = useConnectivityStore()

const list = useTemplateRef<HTMLElement>('list')
const sortableScope = props.nested ? 'category-child' : 'category-root'
const { move } = useSortableList(list, {
  scope: sortableScope,
  ids: () => props.nodes.map((node) => node.category.id),
  onReorder: (categoryIds) => emit('reorder', categoryIds),
})

function label(category: Category): string {
  if (!category.isSystem) {
    return category.name
  }
  return category.kind === 'adjustment'
    ? t('categories.system.adjustment')
    : t('categories.system.interest')
}

function actionItems(category: Category): DropdownMenuItem[][] {
  const select = (kind: CategoryActionKind) =>
    emit('action', { kind, category })
  const remove: DropdownMenuItem = {
    label: t('common.delete'),
    icon: icons.delete,
    color: 'error',
    disabled: connectivity.offline,
    onSelect: () => select('delete'),
  }
  if (category.archivedAt !== null) {
    return [
      [
        {
          label: t('common.restore'),
          icon: icons.restore,
          disabled: connectivity.offline,
          onSelect: () => select('restore'),
        },
      ],
      [remove],
    ]
  }
  const main: DropdownMenuItem[] = [
    {
      label: t('common.edit'),
      icon: icons.edit,
      disabled: connectivity.offline,
      onSelect: () => select('edit'),
    },
  ]
  if (category.parentId === null) {
    main.push({
      label: t('categories.addChild'),
      icon: icons.add,
      disabled: connectivity.offline,
      onSelect: () => select('addChild'),
    })
  }
  main.push({
    label: t('common.archive'),
    icon: icons.archive,
    disabled: connectivity.offline,
    onSelect: () => select('archive'),
  })
  return [main, [remove]]
}
</script>

<template>
  <ul
    ref="list"
    :class="
      nested ? 'ml-4 border-l border-default pl-2' : 'divide-y divide-default'
    "
  >
    <li
      v-for="(node, index) in nodes"
      :key="node.category.id"
      :data-sortable-item="sortableScope"
      :data-testid="`category-${node.category.id}`"
    >
      <div class="flex items-center gap-2 py-1.5">
        <span
          v-if="reordering && !node.category.isSystem"
          :data-drag-handle="sortableScope"
          class="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted max-lg:size-11"
          aria-hidden="true"
        >
          <UIcon :name="icons.dragHandle" class="size-5" />
        </span>
        <span
          class="min-w-0 flex-1 truncate text-sm"
          :class="
            node.category.archivedAt === null ? 'text-default' : 'text-muted'
          "
          data-testid="category-name"
        >
          {{ label(node.category) }}
        </span>
        <UBadge
          v-if="node.category.archivedAt !== null"
          :label="t('categories.archived')"
          color="neutral"
          variant="soft"
        />
        <UBadge
          v-if="node.category.isSystem"
          :label="t('categories.system.badge')"
          :icon="icons.systemCategory"
          color="neutral"
          variant="soft"
        />
        <template v-if="!node.category.isSystem">
          <template v-if="reordering">
            <UButton
              :icon="icons.moveUp"
              :aria-label="t('common.moveUp', { name: node.category.name })"
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
              :aria-label="t('common.moveDown', { name: node.category.name })"
              :disabled="index === nodes.length - 1"
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
            :items="actionItems(node.category)"
            :content="{ align: 'end' }"
          >
            <UButton
              :icon="icons.rowActions"
              :aria-label="t('common.actionsFor', { name: node.category.name })"
              :class="touchIconButtonClass"
              color="neutral"
              variant="ghost"
              square
              data-testid="category-actions"
            />
          </UDropdownMenu>
        </template>
      </div>
      <CategoryList
        v-if="node.children.length > 0"
        :nodes="node.children"
        :reordering="reordering"
        nested
        @reorder="emit('reorder', $event)"
        @action="emit('action', $event)"
      />
    </li>
  </ul>
</template>
