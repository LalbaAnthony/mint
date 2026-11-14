<script setup lang="ts">
import {
  emailChangeRequestSchema,
  sessionListResponseSchema,
  updateProfileRequestSchema,
} from '@mint/shared/schemas/profile'
import { userProfileSchema } from '@mint/shared/schemas/user'
import type { SessionSummary } from '@mint/shared/types/profile'
import { changePasswordFormSchema } from '~~/schemas/forms'
import type {
  ChangePasswordFormState,
  ProfileFormState,
  SelectItem,
} from '~~/types/forms'

const { t } = useI18n()
const toast = useToast()
const session = useSessionStore()
const { validator, errorMessage } = useFormValidation()
const { formatDateTime } = useFormatters()

const preferences = reactive<ProfileFormState>({
  locale: session.user?.locale ?? 'fr',
  forecastHorizonMonths: session.user?.forecastHorizonMonths ?? 3,
  targets: {
    needs: session.user?.targets.needs ?? 50,
    wants: session.user?.targets.wants ?? 30,
    save: session.user?.targets.save ?? 20,
  },
})
const savingPreferences = ref(false)

const localeItems = computed<SelectItem<'fr' | 'en'>[]>(() => [
  { label: t('locales.fr'), value: 'fr' },
  { label: t('locales.en'), value: 'en' },
])

const horizonItems = computed<SelectItem<number>[]>(() =>
  Array.from({ length: 12 }, (_, index) => ({
    label: t('profile.monthCount', index + 1),
    value: index + 1,
  })),
)

const targetKeys = ['needs', 'wants', 'save'] as const

function notifyFailure(error: unknown): void {
  toast.add({
    title: errorMessage(error),
    icon: icons.error,
    color: 'error',
  })
}

async function savePreferences(): Promise<void> {
  savingPreferences.value = true
  try {
    const body = updateProfileRequestSchema.parse(preferences)
    session.setUser(await apiCall('PATCH', '/profile', userProfileSchema, body))
    toast.add({
      title: t('profile.preferencesSaved'),
      icon: icons.success,
      color: 'success',
    })
  } catch (error) {
    notifyFailure(error)
  } finally {
    savingPreferences.value = false
  }
}

const emailOpen = ref(false)
const emailState = reactive({ newEmail: '', password: '' })
const sendingEmail = ref(false)

async function requestEmailChange(): Promise<void> {
  sendingEmail.value = true
  try {
    await apiCommand('POST', '/profile/email', {
      newEmail: emailState.newEmail.trim(),
      password: emailState.password,
    })
    toast.add({
      title: t('profile.emailLinkSent', { email: emailState.newEmail.trim() }),
      icon: icons.success,
      color: 'success',
    })
    emailOpen.value = false
    emailState.newEmail = ''
    emailState.password = ''
  } catch (error) {
    notifyFailure(error)
  } finally {
    sendingEmail.value = false
  }
}

const passwordOpen = ref(false)
const passwordState = reactive<ChangePasswordFormState>({
  currentPassword: '',
  password: '',
  confirmation: '',
})
const changingPassword = ref(false)

async function leaveAfterRevocation(message: string): Promise<void> {
  session.clear()
  toast.add({ title: message, icon: icons.success, color: 'success' })
  await navigateTo('/login')
}

async function changePassword(): Promise<void> {
  changingPassword.value = true
  try {
    await apiCommand('POST', '/profile/password', {
      currentPassword: passwordState.currentPassword,
      newPassword: passwordState.password,
    })
    passwordOpen.value = false
    await leaveAfterRevocation(t('auth.passwordChanged'))
  } catch (error) {
    notifyFailure(error)
  } finally {
    changingPassword.value = false
  }
}

const sessions = ref<SessionSummary[]>([])
const revokeOpen = ref(false)
const revoking = ref(false)

async function loadSessions(): Promise<void> {
  try {
    sessions.value = await apiGet(
      '/profile/sessions',
      sessionListResponseSchema,
    )
  } catch (error) {
    notifyFailure(error)
  }
}

async function revokeAllSessions(): Promise<void> {
  revoking.value = true
  try {
    await apiCommand('DELETE', '/profile/sessions')
    revokeOpen.value = false
    await leaveAfterRevocation(t('profile.loggedOutEverywhere'))
  } catch (error) {
    notifyFailure(error)
  } finally {
    revoking.value = false
  }
}

onMounted(loadSessions)
</script>

<template>
  <ViewPanel :title="t('navigation.profileAndPreferences')">
    <div class="flex max-w-2xl flex-col gap-6">
      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t('profile.preferences') }}
          </h2>
        </template>
        <UForm
          :state="preferences"
          :validate="validator(updateProfileRequestSchema)"
          class="flex flex-col gap-4"
          data-testid="preferences-form"
          @submit="savePreferences"
        >
          <AppFormField :label="t('profile.language')" name="locale">
            <USelect
              v-model="preferences.locale"
              :items="localeItems"
              class="w-full"
            />
          </AppFormField>
          <AppFormField
            :label="t('profile.forecastHorizon')"
            name="forecastHorizonMonths"
          >
            <USelect
              v-model="preferences.forecastHorizonMonths"
              :items="horizonItems"
              class="w-full"
            />
          </AppFormField>
          <AppFormField
            :label="t('profile.targets')"
            :hint="t('profile.targetsRule')"
            name="targets"
          >
            <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <AppFormField
                v-for="key in targetKeys"
                :key="key"
                :label="t(`groups.${key}`)"
                :name="`targets.${key}`"
              >
                <UInputNumber
                  v-model="preferences.targets[key]"
                  :min="0"
                  :max="100"
                  class="w-full tabular-nums"
                />
              </AppFormField>
            </div>
          </AppFormField>
          <div>
            <UButton
              type="submit"
              :label="t('common.save')"
              :loading="savingPreferences"
              color="primary"
              variant="solid"
              data-testid="preferences-submit"
            />
          </div>
        </UForm>
      </UCard>

      <CategoryManager />

      <UCard>
        <template #header>
          <h2 class="text-base font-semibold text-highlighted">
            {{ t('profile.account') }}
          </h2>
        </template>
        <div class="flex flex-col gap-4">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="min-w-0">
              <p class="text-sm font-medium text-muted">
                {{ t('auth.email') }}
              </p>
              <p
                class="truncate text-sm text-highlighted"
                data-testid="profile-email"
              >
                {{ session.user?.email }}
              </p>
            </div>
            <UButton
              :label="t('profile.changeEmail')"
              color="neutral"
              variant="outline"
              @click="emailOpen = true"
            />
          </div>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <p class="text-sm text-muted">{{ t('profile.passwordHelp') }}</p>
            <UButton
              :label="t('profile.changePassword')"
              color="neutral"
              variant="outline"
              @click="passwordOpen = true"
            />
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-base font-semibold text-highlighted">
              {{ t('profile.sessions') }}
            </h2>
            <UButton
              :label="t('profile.logoutEverywhere')"
              :icon="icons.logout"
              color="error"
              variant="outline"
              data-testid="logout-everywhere"
              @click="revokeOpen = true"
            />
          </div>
        </template>
        <ul class="divide-y divide-default" data-testid="session-list">
          <li
            v-for="item in sessions"
            :key="item.id"
            class="flex flex-col gap-1 py-3 first:pt-0 last:pb-0"
          >
            <div class="flex items-center gap-2">
              <span class="truncate text-sm text-highlighted">
                {{ item.userAgent ?? t('profile.unknownDevice') }}
              </span>
              <UBadge
                v-if="item.current"
                :label="t('profile.currentSession')"
                color="primary"
                variant="soft"
              />
            </div>
            <p class="text-xs text-muted tabular-nums">
              {{
                t('profile.sessionDetails', {
                  ip: item.ip ?? '-',
                  lastSeen: formatDateTime(item.lastSeenAt),
                })
              }}
            </p>
          </li>
        </ul>
      </UCard>
    </div>

    <UModal v-model:open="emailOpen" :title="t('profile.changeEmail')">
      <template #body>
        <UForm
          :state="emailState"
          :validate="validator(emailChangeRequestSchema)"
          :validate-on="['blur']"
          class="flex flex-col gap-4"
          @submit="requestEmailChange"
        >
          <AppFormField :label="t('profile.newEmail')" name="newEmail">
            <UInput
              v-model.trim="emailState.newEmail"
              type="email"
              autocomplete="email"
              class="w-full"
            />
          </AppFormField>
          <AppFormField :label="t('auth.currentPassword')" name="password">
            <UInput
              v-model="emailState.password"
              type="password"
              autocomplete="current-password"
              class="w-full"
            />
          </AppFormField>
          <UButton
            type="submit"
            :label="t('profile.sendConfirmation')"
            :loading="sendingEmail"
            color="primary"
            variant="solid"
            block
          />
        </UForm>
      </template>
    </UModal>

    <UModal v-model:open="passwordOpen" :title="t('profile.changePassword')">
      <template #body>
        <UForm
          :state="passwordState"
          :validate="validator(changePasswordFormSchema)"
          :validate-on="['blur']"
          class="flex flex-col gap-4"
          @submit="changePassword"
        >
          <AppFormField
            :label="t('auth.currentPassword')"
            name="currentPassword"
          >
            <UInput
              v-model="passwordState.currentPassword"
              type="password"
              autocomplete="current-password"
              class="w-full"
            />
          </AppFormField>
          <AppFormField
            :label="t('auth.newPassword')"
            :hint="t('auth.passwordRule')"
            name="password"
          >
            <UInput
              v-model="passwordState.password"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </AppFormField>
          <AppFormField
            :label="t('auth.passwordConfirmation')"
            name="confirmation"
          >
            <UInput
              v-model="passwordState.confirmation"
              type="password"
              autocomplete="new-password"
              class="w-full"
            />
          </AppFormField>
          <p class="text-sm text-muted">
            {{ t('profile.passwordChangeEffect') }}
          </p>
          <UButton
            type="submit"
            :label="t('auth.savePassword')"
            :loading="changingPassword"
            color="primary"
            variant="solid"
            block
          />
        </UForm>
      </template>
    </UModal>

    <ConfirmModal
      v-model:open="revokeOpen"
      :title="t('profile.logoutEverywhere')"
      :description="t('profile.logoutEverywhereEffect')"
      :confirm-label="t('profile.logoutEverywhere')"
      :pending="revoking"
      @confirm="revokeAllSessions"
    />
  </ViewPanel>
</template>
