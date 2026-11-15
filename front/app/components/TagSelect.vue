<script setup lang="ts">
import type { TagSelectProps } from '~~/types/components'
import type { SelectItem } from '~~/types/forms'

defineProps<TagSelectProps>()
const model = defineModel<string[]>({ required: true })

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const referentials = useReferentialsStore()

const creating = ref(false)

const items = computed<SelectItem<string>[]>(() =>
  referentials.tags.map((tag) => ({ label: tag.name, value: tag.id })),
)

async function create(name: string): Promise<void> {
  const trimmed = name.trim()
  if (trimmed === '') {
    return
  }
  creating.value = true
  try {
    const tag = await referentials.createTag(trimmed)
    if (!model.value.includes(tag.id)) {
      model.value = [...model.value, tag.id]
    }
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <USelectMenu
    v-model="model"
    :items="items"
    value-key="value"
    multiple
    create-item
    :loading="creating"
    :placeholder="t('tags.placeholder')"
    :search-input="{ placeholder: t('tags.search') }"
    class="w-full"
    :data-testid="testId"
    @create="create"
  />
</template>
