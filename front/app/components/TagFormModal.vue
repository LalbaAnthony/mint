<script setup lang="ts">
import { tagRequestSchema, tagSchema } from '@mint/shared/schemas/tags'
import type { TagFormModalEmits, TagFormModalProps } from '~~/types/components'
import type { TagFormState } from '~~/types/forms'

const props = defineProps<TagFormModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<TagFormModalEmits>()

const { t } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()

const saving = ref(false)
const state = reactive<TagFormState>({ name: '' })

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      state.name = props.tag?.name ?? ''
    }
  },
  { immediate: true },
)

async function submit(): Promise<void> {
  saving.value = true
  try {
    const body = { name: state.name }
    const saved =
      props.tag === null
        ? await apiCall('POST', '/tags', tagSchema, body)
        : await apiCall('PATCH', `/tags/${props.tag.id}`, tagSchema, body)
    emit('saved', saved)
    open.value = false
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="tag === null ? t('tags.createTitle') : t('tags.editTitle')"
  >
    <template #body>
      <UForm
        :state="state"
        :validate="validator(tagRequestSchema)"
        :validate-on="['blur']"
        class="flex flex-col gap-4"
        data-testid="tag-form"
        @submit="submit"
      >
        <AppFormField :label="t('tags.fields.name')" name="name">
          <UInput v-model="state.name" class="w-full" data-testid="tag-name" />
        </AppFormField>
        <OfflineGuard block v-slot="{ offline }">
          <UButton
            :disabled="offline"
            type="submit"
            :label="t('common.save')"
            :loading="saving"
            color="primary"
            variant="solid"
            block
            data-testid="tag-submit"
          />
        </OfflineGuard>
      </UForm>
    </template>
  </UModal>
</template>
