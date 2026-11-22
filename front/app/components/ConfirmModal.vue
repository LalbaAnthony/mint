<script setup lang="ts">
import type { ConfirmModalEmits, ConfirmModalProps } from '~~/types/components'

const props = defineProps<ConfirmModalProps>()

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<ConfirmModalEmits>()

const { t } = useI18n()
const connectivity = useConnectivityStore()
const actions = useTemplateRef<HTMLElement>('actions')

useDialogSubmitShortcut(
  actions,
  () => emit('confirm'),
  () =>
    open.value &&
    !connectivity.offline &&
    props.blocked !== true &&
    props.pending !== true,
)
</script>

<template>
  <UModal v-model:open="open" :title="title" :description="description">
    <template #footer="{ close }">
      <div ref="actions" class="flex w-full justify-end gap-2">
        <UButton
          :label="t('common.cancel')"
          color="neutral"
          variant="outline"
          @click="close"
        />
        <OfflineGuard v-slot="{ offline }">
          <ShortcutTooltip shortcut="submit">
            <UButton
              :label="confirmLabel"
              :loading="pending"
              :disabled="offline || blocked"
              color="error"
              variant="solid"
              data-testid="confirm-modal-confirm"
              @click="emit('confirm')"
            />
          </ShortcutTooltip>
        </OfflineGuard>
      </div>
    </template>
  </UModal>
</template>
