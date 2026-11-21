<script setup lang="ts">
import type { UsageCounts } from '@mint/shared/types/operations'
import type { SelectItem } from '~~/types/forms'
import type {
  CategoryDeleteModalEmits,
  CategoryDeleteModalProps,
} from '~~/types/planning'

const props = defineProps<CategoryDeleteModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<CategoryDeleteModalEmits>()

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { loadUsage, references } = useUsageNotice()

const usage = ref<UsageCounts | null>(null)
const replacementId = ref<string | undefined>(undefined)
const pending = ref(false)

provideFieldAutofocus({
  values: () => ({ replacementId: replacementId.value }),
})

watch(
  [open, () => props.category?.id],
  async ([isOpen]) => {
    const category = props.category
    usage.value = null
    replacementId.value = undefined
    if (!isOpen || category === null) {
      return
    }
    try {
      usage.value = await loadUsage(`/categories/${category.id}`)
    } catch (error) {
      toast.add({
        title: errorMessage(error),
        icon: icons.error,
        color: 'error',
      })
    }
  },
  { immediate: true },
)

const isUsed = computed(
  () =>
    usage.value !== null &&
    usage.value.operations +
      usage.value.schedules +
      usage.value.envelopes +
      usage.value.rules >
      0,
)

const childCount = computed(
  () =>
    props.categories.filter((child) => child.parentId === props.category?.id)
      .length,
)

const description = computed(() => {
  const category = props.category
  if (category === null) {
    return ''
  }
  if (usage.value === null) {
    return t('usage.checking')
  }
  const effect = t(
    'categories.deleteEffect',
    { name: category.name, n: childCount.value },
    childCount.value,
  )
  return isUsed.value
    ? `${effect} ${t('categories.deleteReassign', { references: references(usage.value) })}`
    : effect
})

const replacementItems = computed<SelectItem<string>[]>(() => {
  const category = props.category
  if (category === null || category.kind === 'adjustment') {
    return []
  }
  const removed = new Set([
    category.id,
    ...props.categories
      .filter((child) => child.parentId === category.id)
      .map((child) => child.id),
  ])
  return categoryOptionGroups(
    props.categories.filter((candidate) => !candidate.isSystem),
    [category.kind],
    undefined,
    (kind) => t(`categories.kinds.${kind}`),
  )
    .flatMap((group) => group.options)
    .filter((option) => !removed.has(option.value))
})

const blocked = computed(
  () =>
    usage.value === null || (isUsed.value && replacementId.value === undefined),
)

async function confirm(): Promise<void> {
  const category = props.category
  if (category === null || blocked.value) {
    return
  }
  pending.value = true
  try {
    const query =
      isUsed.value && replacementId.value !== undefined
        ? `?replacementId=${replacementId.value}`
        : ''
    await apiCommand('DELETE', `/categories/${category.id}${query}`)
    open.value = false
    emit('deleted', category)
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('categories.deleteTitle')"
    :description="description"
  >
    <template v-if="isUsed" #body>
      <AppFormField :label="t('categories.replacement')" name="replacementId">
        <USelect
          v-model="replacementId"
          :items="replacementItems"
          class="w-full"
          data-testid="category-replacement"
        />
      </AppFormField>
    </template>
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <OfflineGuard v-slot="{ offline }">
          <UButton
            :label="t('common.delete')"
            :loading="pending"
            :disabled="offline || blocked"
            color="error"
            variant="solid"
            data-testid="confirm-modal-confirm"
            @click="confirm"
          />
        </OfflineGuard>
      </div>
    </template>
  </UModal>
</template>
