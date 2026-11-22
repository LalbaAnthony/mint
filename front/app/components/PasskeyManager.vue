<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  maxPasskeysPerUser,
  passkeyListResponseSchema,
  passkeySchema,
} from '@mint/shared/schemas/passkeys'
import type { Passkey } from '@mint/shared/types/passkeys'
import { passkeyFormSchema, passkeyRenameFormSchema } from '~~/schemas/forms'
import type { PasskeyFormState } from '~~/types/passkeys'

const { t } = useI18n()
const connectivity = useConnectivityStore()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const { formatDateTime } = useFormatters()

const passkeys = ref<Passkey[]>([])
const supported = ref(false)

const addOpen = ref(false)
const adding = ref(false)
const addState = reactive<PasskeyFormState>({ name: '', password: '' })

const renamed = ref<Passkey | null>(null)
const renaming = ref(false)
const renameState = reactive({ name: '' })

const removed = ref<Passkey | null>(null)
const removing = ref(false)

const limitReached = computed(() => passkeys.value.length >= maxPasskeysPerUser)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const loadState = useLoadState({ onError: notifyFailure })

async function fetchPasskeys(): Promise<void> {
  passkeys.value = await apiGet('/profile/passkeys', passkeyListResponseSchema)
}

function load(): Promise<void> {
  return loadState.run(fetchPasskeys, 'background')
}

function details(passkey: Passkey): string {
  return t('passkeys.details', {
    createdAt: formatDateTime(passkey.createdAt),
    lastUsed:
      passkey.lastUsedAt === null
        ? t('passkeys.neverUsed')
        : formatDateTime(passkey.lastUsedAt),
  })
}

function openAdd(): void {
  addState.name = suggestedPasskeyName(navigator.userAgent)
  addState.password = ''
  addOpen.value = true
}

async function add(): Promise<void> {
  adding.value = true
  try {
    const result = await registerPasskey(
      addState.name.trim(),
      addState.password,
    )
    if (result === 'cancelled') {
      return
    }
    if (result === 'already_registered') {
      toast.add({
        title: t('passkeys.alreadyRegistered'),
        icon: icons.info,
        color: 'info',
      })
      return
    }
    addOpen.value = false
    toast.add({
      title: t('passkeys.added', { name: result.name }),
      icon: icons.success,
      color: 'success',
    })
    await load()
  } catch (error) {
    notifyFailure(error)
  } finally {
    adding.value = false
  }
}

const renameOpen = computed({
  get: () => renamed.value !== null,
  set: (open) => {
    if (!open) {
      renamed.value = null
    }
  },
})

function openRename(passkey: Passkey): void {
  renameState.name = passkey.name
  renamed.value = passkey
}

async function rename(): Promise<void> {
  const passkey = renamed.value
  if (passkey === null) {
    return
  }
  renaming.value = true
  try {
    await apiCall('PATCH', `/profile/passkeys/${passkey.id}`, passkeySchema, {
      name: renameState.name.trim(),
    })
    renamed.value = null
    await load()
  } catch (error) {
    notifyFailure(error)
  } finally {
    renaming.value = false
  }
}

const removeOpen = computed({
  get: () => removed.value !== null,
  set: (open) => {
    if (!open) {
      removed.value = null
    }
  },
})

async function remove(): Promise<void> {
  const passkey = removed.value
  if (passkey === null) {
    return
  }
  removing.value = true
  try {
    await apiCommand('DELETE', `/profile/passkeys/${passkey.id}`)
    removed.value = null
    toast.add({
      title: t('passkeys.deleted', { name: passkey.name }),
      icon: icons.success,
      color: 'success',
    })
    await load()
  } catch (error) {
    notifyFailure(error)
  } finally {
    removing.value = false
  }
}

function actionsFor(passkey: Passkey): DropdownMenuItem[][] {
  return [
    [
      {
        label: t('passkeys.rename'),
        icon: icons.edit,
        disabled: connectivity.offline,
        onSelect: () => openRename(passkey),
      },
    ],
    [
      {
        label: t('common.delete'),
        icon: icons.delete,
        color: 'error',
        disabled: connectivity.offline,
        onSelect: () => {
          removed.value = passkey
        },
      },
    ],
  ]
}

onMounted(() => {
  supported.value = passkeysSupported()
  void loadState.run(fetchPasskeys)
})
</script>

<template>
  <UCard data-testid="passkey-manager">
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-base font-semibold text-highlighted">
          {{ t('passkeys.title') }}
        </h2>
        <OfflineGuard v-if="supported" v-slot="{ offline }">
          <UButton
            :icon="icons.passkey"
            :label="t('passkeys.add')"
            :disabled="offline || limitReached"
            color="primary"
            variant="soft"
            data-testid="passkeys-add"
            @click="openAdd"
          />
        </OfflineGuard>
      </div>
    </template>
    <div class="flex flex-col gap-3">
      <p class="text-sm text-muted">{{ t('passkeys.help') }}</p>
      <p
        v-if="!supported"
        class="text-sm text-muted"
        data-testid="passkeys-unsupported"
      >
        {{ t('passkeys.unsupported') }}
      </p>
      <p v-if="limitReached" class="text-sm text-muted">
        {{ t('passkeys.limit', { n: maxPasskeysPerUser }) }}
      </p>
      <LoadZone :state="loadState">
        <template #skeleton>
          <SkeletonDetailList
            leading
            actions="touch"
            :row="{ spread: true }"
            class="flex flex-col divide-y divide-default"
          />
        </template>
        <p
          v-if="passkeys.length === 0"
          class="text-sm text-muted"
          data-testid="passkeys-empty"
        >
          {{ t('passkeys.empty') }}
        </p>
        <ul v-else class="flex flex-col divide-y divide-default">
          <ListRow
            v-for="passkey in passkeys"
            :key="passkey.id"
            spread
            :data-testid="`passkey-row-${passkey.id}`"
          >
            <div class="flex min-w-0 items-center gap-2">
              <UIcon
                :name="icons.passkey"
                class="size-4 shrink-0 text-muted"
                aria-hidden="true"
              />
              <div class="min-w-0">
                <p class="truncate text-sm text-default">{{ passkey.name }}</p>
                <p class="text-xs text-muted tabular-nums">
                  {{ details(passkey) }}
                </p>
              </div>
            </div>
            <UDropdownMenu :items="actionsFor(passkey)">
              <UButton
                :icon="icons.rowActions"
                :aria-label="t('common.actionsFor', { name: passkey.name })"
                :class="touchIconButtonClass"
                color="neutral"
                variant="ghost"
                :data-testid="`passkey-actions-${passkey.id}`"
              />
            </UDropdownMenu>
          </ListRow>
        </ul>
      </LoadZone>
    </div>

    <UModal
      v-model:open="addOpen"
      :title="t('passkeys.addTitle')"
      :description="t('passkeys.addHelp')"
    >
      <template #body>
        <AppForm
          :state="addState"
          :validate="validator(passkeyFormSchema)"
          :validate-on="['blur']"
          class="flex flex-col gap-4"
          data-testid="passkey-form"
          @submit="add"
        >
          <AppFormField :label="t('passkeys.name')" name="name">
            <UInput
              v-model="addState.name"
              class="w-full"
              data-testid="passkey-name"
            />
          </AppFormField>
          <AppFormField :label="t('auth.currentPassword')" name="password">
            <UInput
              v-model="addState.password"
              type="password"
              autocomplete="current-password"
              class="w-full"
              data-testid="passkey-password"
            />
          </AppFormField>
          <OfflineGuard block v-slot="{ offline }">
            <ShortcutTooltip shortcut="submit">
              <UButton
                :disabled="offline"
                type="submit"
                :label="t('passkeys.create')"
                :icon="icons.passkey"
                :loading="adding"
                color="primary"
                variant="solid"
                block
                data-testid="passkey-submit"
              />
            </ShortcutTooltip>
          </OfflineGuard>
        </AppForm>
      </template>
    </UModal>

    <UModal v-model:open="renameOpen" :title="t('passkeys.renameTitle')">
      <template #body>
        <AppForm
          :state="renameState"
          :validate="validator(passkeyRenameFormSchema)"
          :validate-on="['blur']"
          class="flex flex-col gap-4"
          data-testid="passkey-rename-form"
          @submit="rename"
        >
          <AppFormField :label="t('passkeys.name')" name="name">
            <UInput
              v-model="renameState.name"
              class="w-full"
              data-testid="passkey-rename-name"
            />
          </AppFormField>
          <OfflineGuard block v-slot="{ offline }">
            <ShortcutTooltip shortcut="submit">
              <UButton
                :disabled="offline"
                type="submit"
                :label="t('common.save')"
                :loading="renaming"
                color="primary"
                variant="solid"
                block
                data-testid="passkey-rename-submit"
              />
            </ShortcutTooltip>
          </OfflineGuard>
        </AppForm>
      </template>
    </UModal>

    <ConfirmModal
      v-model:open="removeOpen"
      :title="t('passkeys.deleteTitle')"
      :description="t('passkeys.deleteEffect', { name: removed?.name ?? '' })"
      :confirm-label="t('common.delete')"
      :pending="removing"
      @confirm="remove"
    />
  </UCard>
</template>
