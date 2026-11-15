<script setup lang="ts">
import { passkeyListResponseSchema } from '@mint/shared/schemas/passkeys'
import {
  accountDeletionEmailSchema,
  accountDeletionFormSchema,
  exportFormSchema,
} from '~~/schemas/forms'
import type { AccountDeletionFormState } from '~~/types/passkeys'

const { t } = useI18n()
const toast = useToast()
const session = useSessionStore()
const { validator, errorMessage } = useFormValidation()

const exportOpen = ref(false)
const exporting = ref(false)
const exportState = reactive({ password: '' })

const deleteOpen = ref(false)
const deleting = ref(false)
const deleteState = reactive<AccountDeletionFormState>({
  email: '',
  password: '',
})
const passkeyConfirmation = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

function openExport(): void {
  exportState.password = ''
  exportOpen.value = true
}

async function exportData(): Promise<void> {
  exporting.value = true
  try {
    const archive = await apiDownload('/profile/export', {
      password: exportState.password,
    })
    saveBlob(archive, `mint-export-${parisDate(new Date())}.zip`)
    exportOpen.value = false
    toast.add({
      title: t('personalData.exported'),
      icon: icons.success,
      color: 'success',
    })
  } catch (error) {
    notifyFailure(error)
  } finally {
    exporting.value = false
  }
}

async function openDelete(): Promise<void> {
  deleteState.email = ''
  deleteState.password = ''
  passkeyConfirmation.value = false
  deleteOpen.value = true
  if (!passkeysSupported()) {
    return
  }
  try {
    const passkeys = await apiGet(
      '/profile/passkeys',
      passkeyListResponseSchema,
    )
    passkeyConfirmation.value = passkeys.length > 0
  } catch (error) {
    notifyFailure(error)
  }
}

async function disablePushHere(): Promise<void> {
  try {
    await unsubscribeThisDevice()
  } catch {
    toast.add({
      title: t('personalData.pushNotDisabled'),
      icon: icons.info,
      color: 'warning',
    })
  }
}

async function leaveDeletedAccount(): Promise<void> {
  deleteOpen.value = false
  await disablePushHere()
  session.clear()
  toast.add({
    title: t('personalData.deleted'),
    icon: icons.success,
    color: 'success',
  })
  await navigateTo('/login')
}

async function deleteWithPassword(): Promise<void> {
  deleting.value = true
  try {
    await apiCommand('POST', '/profile/delete', {
      method: 'password',
      email: deleteState.email.trim(),
      password: deleteState.password,
    })
    await leaveDeletedAccount()
  } catch (error) {
    notifyFailure(error)
  } finally {
    deleting.value = false
  }
}

async function deleteWithPasskey(): Promise<void> {
  if (
    !accountDeletionEmailSchema.safeParse({ email: deleteState.email.trim() })
      .success
  ) {
    toast.add({
      title: t('personalData.emailFirst'),
      icon: icons.error,
      color: 'error',
    })
    return
  }
  deleting.value = true
  try {
    const result = await deleteAccountWithPasskey(deleteState.email.trim())
    if (result === 'deleted') {
      await leaveDeletedAccount()
    }
  } catch (error) {
    notifyFailure(error)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UCard data-testid="personal-data">
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        {{ t('personalData.title') }}
      </h2>
    </template>
    <div class="flex flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted">{{ t('personalData.exportHelp') }}</p>
        <UButton
          :label="t('personalData.export')"
          :icon="icons.download"
          color="primary"
          variant="soft"
          data-testid="personal-data-export"
          @click="openExport"
        />
      </div>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <p class="text-sm text-muted">{{ t('personalData.deleteHelp') }}</p>
        <UButton
          :label="t('personalData.delete')"
          :icon="icons.delete"
          color="error"
          variant="outline"
          data-testid="personal-data-delete"
          @click="openDelete"
        />
      </div>
    </div>

    <UModal
      v-model:open="exportOpen"
      :title="t('personalData.exportTitle')"
      :description="t('personalData.exportContent')"
    >
      <template #body>
        <UForm
          :state="exportState"
          :validate="validator(exportFormSchema)"
          :validate-on="['blur']"
          class="flex flex-col gap-4"
          data-testid="export-form"
          @submit="exportData"
        >
          <AppFormField :label="t('auth.currentPassword')" name="password">
            <UInput
              v-model="exportState.password"
              type="password"
              autocomplete="current-password"
              class="w-full"
              data-testid="export-password"
            />
          </AppFormField>
          <UButton
            type="submit"
            :label="t('personalData.download')"
            :icon="icons.download"
            :loading="exporting"
            color="primary"
            variant="solid"
            block
            data-testid="export-submit"
          />
        </UForm>
      </template>
    </UModal>

    <UModal
      v-model:open="deleteOpen"
      :title="t('personalData.deleteTitle')"
      :description="t('personalData.deleteEffect')"
    >
      <template #body>
        <UForm
          :state="deleteState"
          :validate="validator(accountDeletionFormSchema)"
          :validate-on="['blur']"
          class="flex flex-col gap-4"
          data-testid="delete-account-form"
          @submit="deleteWithPassword"
        >
          <AppFormField
            :label="t('personalData.emailConfirmation')"
            :hint="session.user?.email"
            name="email"
          >
            <UInput
              v-model="deleteState.email"
              type="email"
              autocomplete="off"
              class="w-full"
              data-testid="delete-account-email"
            />
          </AppFormField>
          <AppFormField :label="t('auth.currentPassword')" name="password">
            <UInput
              v-model="deleteState.password"
              type="password"
              autocomplete="current-password"
              class="w-full"
              data-testid="delete-account-password"
            />
          </AppFormField>
          <UButton
            type="submit"
            :label="t('personalData.deleteForever')"
            :loading="deleting"
            color="error"
            variant="solid"
            block
            data-testid="delete-account-submit"
          />
        </UForm>
        <template v-if="passkeyConfirmation">
          <USeparator :label="t('auth.or')" class="my-4" />
          <UButton
            :label="t('personalData.deleteWithPasskey')"
            :icon="icons.passkey"
            :loading="deleting"
            color="neutral"
            variant="outline"
            block
            data-testid="delete-account-passkey"
            @click="deleteWithPasskey"
          />
        </template>
      </template>
    </UModal>
  </UCard>
</template>
