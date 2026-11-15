<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { Tag } from '@mint/shared/types/tags'

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const referentials = useReferentialsStore()

const formOpen = ref(false)
const editedTag = ref<Tag | null>(null)
const tagToDelete = ref<Tag | null>(null)
const deleting = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function load(): Promise<void> {
  try {
    await referentials.loadTags()
  } catch (error) {
    notifyFailure(error)
  }
}

function usage(tag: Tag): string {
  return [
    t('tags.usage.operations', { n: tag.operationCount }, tag.operationCount),
    t('tags.usage.schedules', { n: tag.scheduleCount }, tag.scheduleCount),
    t('tags.usage.rules', { n: tag.ruleCount }, tag.ruleCount),
  ].join(' · ')
}

function openForm(tag: Tag | null): void {
  editedTag.value = tag
  formOpen.value = true
}

async function saved(tag: Tag): Promise<void> {
  toast.add({
    title: t('tags.saved', { name: tag.name }),
    icon: icons.success,
    color: 'success',
  })
  await load()
}

const deleteOpen = computed({
  get: () => tagToDelete.value !== null,
  set: (open) => {
    if (!open) {
      tagToDelete.value = null
    }
  },
})

const deleteDescription = computed(() =>
  tagToDelete.value === null
    ? ''
    : t('tags.deleteEffect', {
        name: tagToDelete.value.name,
        usage: usage(tagToDelete.value),
      }),
)

async function confirmDelete(): Promise<void> {
  const tag = tagToDelete.value
  if (tag === null) {
    return
  }
  deleting.value = true
  try {
    await apiCommand('DELETE', `/tags/${tag.id}`)
    tagToDelete.value = null
    toast.add({
      title: t('tags.deleted', { name: tag.name }),
      icon: icons.success,
      color: 'success',
    })
  } catch (error) {
    notifyFailure(error)
  } finally {
    deleting.value = false
    await load()
  }
}

function actionsFor(tag: Tag): DropdownMenuItem[][] {
  return [
    [
      {
        label: t('common.edit'),
        icon: icons.edit,
        onSelect: () => openForm(tag),
      },
    ],
    [
      {
        label: t('common.delete'),
        icon: icons.delete,
        color: 'error',
        onSelect: () => {
          tagToDelete.value = tag
        },
      },
    ],
  ]
}

onMounted(load)
</script>

<template>
  <UCard data-testid="tag-manager">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-highlighted">
          {{ t('tags.title') }}
        </h2>
        <UButton
          :icon="icons.add"
          :label="t('tags.add')"
          color="primary"
          variant="soft"
          data-testid="tags-add"
          @click="openForm(null)"
        />
      </div>
    </template>
    <p
      v-if="referentials.tags.length === 0"
      class="text-sm text-muted"
      data-testid="tags-empty"
    >
      {{ t('tags.empty') }}
    </p>
    <ul v-else class="flex flex-col divide-y divide-default">
      <li
        v-for="tag in referentials.tags"
        :key="tag.id"
        class="flex items-center justify-between gap-2 py-2"
        :data-testid="`tag-row-${tag.id}`"
      >
        <div class="min-w-0">
          <p class="truncate text-sm text-default">{{ tag.name }}</p>
          <p class="text-xs text-muted">{{ usage(tag) }}</p>
        </div>
        <UDropdownMenu :items="actionsFor(tag)">
          <UButton
            :icon="icons.rowActions"
            :aria-label="t('common.actionsFor', { name: tag.name })"
            color="neutral"
            variant="ghost"
            :data-testid="`tag-actions-${tag.id}`"
          />
        </UDropdownMenu>
      </li>
    </ul>

    <TagFormModal v-model:open="formOpen" :tag="editedTag" @saved="saved" />

    <ConfirmModal
      v-model:open="deleteOpen"
      :title="t('tags.deleteTitle')"
      :description="deleteDescription"
      :confirm-label="t('common.delete')"
      :pending="deleting"
      @confirm="confirmDelete"
    />
  </UCard>
</template>
