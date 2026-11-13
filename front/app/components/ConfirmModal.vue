<script setup lang="ts">
import type { ConfirmModalEmits, ConfirmModalProps } from '~~/types/components'

defineProps<ConfirmModalProps>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<ConfirmModalEmits>()

const { t } = useI18n()
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #footer="{ close }">
      <div class="flex w-full justify-end gap-2">
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <UButton
          :label="confirmLabel"
          :loading="pending"
          color="error"
          variant="solid"
          data-testid="confirm-modal-confirm"
          @click="emit('confirm')"
        />
      </div>
    </template>
  </UModal>
</template>
