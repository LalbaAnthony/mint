<script setup lang="ts">
import {
  adminInvitationListResponseSchema,
  adminInvitationSchema,
  adminUserListResponseSchema,
  adminUserSchema,
  createInvitationRequestSchema,
} from '@mint/shared/schemas/admin'
import type {
  AdminInvitation,
  AdminUser,
  InvitationStatus,
} from '@mint/shared/types/admin'

definePageMeta({ access: 'admin' })

const { t } = useI18n()
const toast = useToast()
const session = useSessionStore()
const { validator, errorMessage } = useFormValidation()
const { formatDateTime } = useFormatters()

const invitations = ref<AdminInvitation[]>([])
const users = ref<AdminUser[]>([])
const busyId = ref<string | null>(null)

const invitationColors = {
  pending: 'primary',
  accepted: 'success',
  expired: 'neutral',
  revoked: 'neutral',
} as const satisfies Record<InvitationStatus, string>

function notify(title: string): void {
  toast.add({ title, icon: icons.success, color: 'success' })
}

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

const loadState = useLoadState({ onError: notifyFailure })

async function fetchAdministration(): Promise<void> {
  const [invitationList, userList] = await Promise.all([
    apiGet('/admin/invitations', adminInvitationListResponseSchema),
    apiGet('/admin/users', adminUserListResponseSchema),
  ])
  invitations.value = invitationList
  users.value = userList
}

function replaceInvitation(updated: AdminInvitation): void {
  invitations.value = invitations.value.map((invitation) =>
    invitation.id === updated.id ? updated : invitation,
  )
}

function replaceUser(updated: AdminUser): void {
  users.value = users.value.map((user) =>
    user.id === updated.id ? updated : user,
  )
}

async function runFor(id: string, action: () => Promise<void>): Promise<void> {
  busyId.value = id
  try {
    await action()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busyId.value = null
  }
}

const inviteOpen = ref(false)
const inviteState = reactive({ email: '' })
const inviting = ref(false)

async function invite(): Promise<void> {
  inviting.value = true
  try {
    const created = await apiCall(
      'POST',
      '/admin/invitations',
      adminInvitationSchema,
      { email: inviteState.email.trim() },
    )
    invitations.value = [created, ...invitations.value]
    notify(t('admin.invitationSent', { email: created.email }))
    inviteOpen.value = false
    inviteState.email = ''
  } catch (error) {
    notifyFailure(error)
  } finally {
    inviting.value = false
  }
}

function resend(invitation: AdminInvitation): Promise<void> {
  return runFor(invitation.id, async () => {
    replaceInvitation(
      await apiCall(
        'POST',
        `/admin/invitations/${invitation.id}/resend`,
        adminInvitationSchema,
      ),
    )
    notify(t('admin.invitationSent', { email: invitation.email }))
  })
}

const invitationToRevoke = ref<AdminInvitation | null>(null)
const revokeOpen = computed({
  get: () => invitationToRevoke.value !== null,
  set: (open) => {
    if (!open) {
      invitationToRevoke.value = null
    }
  },
})

function revoke(): Promise<void> {
  const invitation = invitationToRevoke.value
  if (invitation === null) {
    return Promise.resolve()
  }
  return runFor(invitation.id, async () => {
    replaceInvitation(
      await apiCall(
        'POST',
        `/admin/invitations/${invitation.id}/revoke`,
        adminInvitationSchema,
      ),
    )
    invitationToRevoke.value = null
  })
}

const userToDisable = ref<AdminUser | null>(null)
const disableOpen = computed({
  get: () => userToDisable.value !== null,
  set: (open) => {
    if (!open) {
      userToDisable.value = null
    }
  },
})

function disable(): Promise<void> {
  const user = userToDisable.value
  if (user === null) {
    return Promise.resolve()
  }
  return runFor(user.id, async () => {
    replaceUser(
      await apiCall('POST', `/admin/users/${user.id}/disable`, adminUserSchema),
    )
    userToDisable.value = null
  })
}

function enable(user: AdminUser): Promise<void> {
  return runFor(user.id, async () => {
    replaceUser(
      await apiCall('POST', `/admin/users/${user.id}/enable`, adminUserSchema),
    )
  })
}

function sendPasswordReset(user: AdminUser): Promise<void> {
  return runFor(user.id, async () => {
    await apiCommand('POST', `/admin/users/${user.id}/password-reset`)
    notify(t('admin.resetLinkSent', { email: user.email }))
  })
}

function invitationDate(invitation: AdminInvitation): string {
  if (invitation.acceptedAt !== null) {
    return t('admin.acceptedOn', {
      date: formatDateTime(invitation.acceptedAt),
    })
  }
  if (invitation.revokedAt !== null) {
    return t('admin.revokedOn', { date: formatDateTime(invitation.revokedAt) })
  }
  return t('admin.expiresOn', { date: formatDateTime(invitation.expiresAt) })
}

function isReusable(invitation: AdminInvitation): boolean {
  return invitation.status === 'pending' || invitation.status === 'expired'
}

onMounted(() => loadState.run(fetchAdministration))

const connectivity = useConnectivityStore()
const createHint = useShortcut(
  'create',
  () => {
    inviteOpen.value = true
  },
  { enabled: () => !connectivity.offline },
)

const invitationRows = useRememberedCount(
  'admin.invitations',
  loadState,
  () => invitations.value.length,
)
const userRows = useRememberedCount(
  'admin.users',
  loadState,
  () => users.value.length,
)
</script>

<template>
  <ViewPanel :title="t('navigation.administration')">
    <template #actions>
      <OfflineGuard v-slot="{ offline }">
        <ShortcutTooltip :hint="createHint" :text="t('admin.invite')">
          <UButton
            :disabled="offline"
            :label="t('admin.invite')"
            :icon="icons.invite"
            color="primary"
            variant="soft"
            data-testid="admin-invite"
            @click="inviteOpen = true"
          />
        </ShortcutTooltip>
      </OfflineGuard>
    </template>

    <div class="flex flex-col gap-6">
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t('admin.invitations') }}
          </h2>
        </template>
        <LoadZone :state="loadState">
          <template #skeleton>
            <AdminListSkeleton :count="invitationRows" />
          </template>
          <EmptyState
            v-if="invitations.length === 0"
            :icon="icons.invite"
            :title="t('admin.noInvitationTitle')"
            :description="t('admin.noInvitationText')"
          >
            <OfflineGuard v-slot="{ offline }">
              <UButton
                :disabled="offline"
                :label="t('admin.invite')"
                :icon="icons.invite"
                color="primary"
                variant="soft"
                @click="inviteOpen = true"
              />
            </OfflineGuard>
          </EmptyState>
          <ul
            v-else
            class="divide-y divide-default"
            data-testid="invitation-list"
          >
            <ListRow
              v-for="invitation in invitations"
              :key="invitation.id"
              :gap="3"
              :padding="3"
              flush
              wrap
              spread
            >
              <div class="flex min-w-0 flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-sm text-highlighted">
                    {{ invitation.email }}
                  </span>
                  <UBadge
                    :label="t(`admin.invitationStatus.${invitation.status}`)"
                    :color="invitationColors[invitation.status]"
                    variant="soft"
                  />
                </div>
                <p class="text-xs text-muted tabular-nums">
                  {{
                    t('admin.sentOn', {
                      date: formatDateTime(invitation.createdAt),
                    })
                  }}
                  · {{ invitationDate(invitation) }}
                </p>
              </div>
              <div v-if="isReusable(invitation)" class="flex flex-wrap gap-1">
                <OfflineGuard v-slot="{ offline }">
                  <UButton
                    :disabled="offline"
                    :label="t('admin.resend')"
                    :icon="icons.resend"
                    :loading="busyId === invitation.id"
                    color="neutral"
                    variant="ghost"
                    @click="resend(invitation)"
                  />
                </OfflineGuard>
                <OfflineGuard v-slot="{ offline }">
                  <UButton
                    :disabled="offline"
                    :label="t('admin.revoke')"
                    :icon="icons.revoke"
                    color="error"
                    variant="ghost"
                    @click="invitationToRevoke = invitation"
                  />
                </OfflineGuard>
              </div>
            </ListRow>
          </ul>
        </LoadZone>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t('admin.users') }}
          </h2>
        </template>
        <LoadZone :state="loadState" :error-state="false">
          <template #skeleton>
            <AdminListSkeleton :count="userRows" />
          </template>
          <ul class="divide-y divide-default" data-testid="user-list">
            <ListRow
              v-for="user in users"
              :key="user.id"
              :gap="3"
              :padding="3"
              flush
              wrap
              spread
            >
              <div class="flex min-w-0 flex-col gap-1">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="truncate text-sm text-highlighted">
                    {{ user.email }}
                  </span>
                  <UBadge
                    :label="t(`admin.roles.${user.role}`)"
                    color="neutral"
                    variant="outline"
                  />
                  <UBadge
                    :label="t(`admin.userStatus.${user.status}`)"
                    :color="user.status === 'active' ? 'success' : 'neutral'"
                    variant="soft"
                  />
                </div>
                <p class="text-xs text-muted tabular-nums">
                  {{ t(`locales.${user.locale}`) }} ·
                  {{
                    t('admin.createdOn', {
                      date: formatDateTime(user.createdAt),
                    })
                  }}
                  ·
                  {{
                    user.lastLoginAt === null
                      ? t('admin.neverLoggedIn')
                      : t('admin.lastLogin', {
                          date: formatDateTime(user.lastLoginAt),
                        })
                  }}
                </p>
              </div>
              <div class="flex flex-wrap gap-1">
                <OfflineGuard
                  v-if="user.status === 'active'"
                  v-slot="{ offline }"
                >
                  <UButton
                    :disabled="offline"
                    :label="t('admin.sendResetLink')"
                    :icon="icons.passwordReset"
                    :loading="busyId === user.id"
                    color="neutral"
                    variant="ghost"
                    @click="sendPasswordReset(user)"
                  />
                </OfflineGuard>
                <OfflineGuard
                  v-if="user.status === 'disabled'"
                  v-slot="{ offline }"
                >
                  <UButton
                    :disabled="offline"
                    :label="t('admin.enable')"
                    :icon="icons.enableUser"
                    :loading="busyId === user.id"
                    color="neutral"
                    variant="ghost"
                    @click="enable(user)"
                  />
                </OfflineGuard>
                <OfflineGuard
                  v-else-if="user.id !== session.user?.id"
                  v-slot="{ offline }"
                >
                  <UButton
                    :disabled="offline"
                    :label="t('admin.disable')"
                    :icon="icons.disableUser"
                    color="error"
                    variant="ghost"
                    @click="userToDisable = user"
                  />
                </OfflineGuard>
              </div>
            </ListRow>
          </ul>
        </LoadZone>
      </UCard>

      <RegulatedCapsCard />
    </div>

    <UModal v-model:open="inviteOpen" :title="t('admin.invite')">
      <template #body>
        <AppForm
          :state="inviteState"
          :validate="validator(createInvitationRequestSchema)"
          :validate-on="['blur']"
          class="flex flex-col gap-4"
          data-testid="invite-form"
          @submit="invite"
        >
          <p class="text-sm text-muted">{{ t('admin.inviteHelp') }}</p>
          <AppFormField :label="t('auth.email')" name="email">
            <UInput
              v-model.trim="inviteState.email"
              type="email"
              class="w-full"
              data-testid="invite-email"
            />
          </AppFormField>
          <OfflineGuard block v-slot="{ offline }">
            <ShortcutTooltip shortcut="submit">
              <UButton
                :disabled="offline"
                type="submit"
                :label="t('admin.sendInvitation')"
                :loading="inviting"
                color="primary"
                variant="solid"
                block
                data-testid="invite-submit"
              />
            </ShortcutTooltip>
          </OfflineGuard>
        </AppForm>
      </template>
    </UModal>

    <ConfirmModal
      v-model:open="revokeOpen"
      :title="t('admin.revokeTitle')"
      :description="
        t('admin.revokeEffect', { email: invitationToRevoke?.email ?? '' })
      "
      :confirm-label="t('admin.revoke')"
      :pending="busyId !== null"
      @confirm="revoke"
    />

    <ConfirmModal
      v-model:open="disableOpen"
      :title="t('admin.disableTitle')"
      :description="
        t('admin.disableEffect', { email: userToDisable?.email ?? '' })
      "
      :confirm-label="t('admin.disable')"
      :pending="busyId !== null"
      @confirm="disable"
    />
  </ViewPanel>
</template>
