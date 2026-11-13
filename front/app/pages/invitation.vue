<script setup lang="ts">
import { invitationStatusResponseSchema } from '@mint/shared/schemas/auth'
import { userProfileSchema } from '@mint/shared/schemas/user'
import { acceptInvitationFormSchema } from '~~/schemas/forms'
import type { AcceptInvitationFormState } from '~~/types/forms'

definePageMeta({ layout: 'auth', access: 'public' })

const { t, locale, setLocale } = useI18n()
const route = useRoute()
const session = useSessionStore()
const { validator, errorMessage } = useFormValidation()

useHead({ title: () => t('invitation.title') })

const token = readHashToken(route.hash)
const email = ref<string | null>(null)
const checking = ref(token !== null)
const failure = ref<string | null>(
  token === null ? t('errors.invitation_invalid') : null,
)
const pending = ref(false)
const state = reactive<AcceptInvitationFormState>({
  password: '',
  confirmation: '',
  locale: locale.value === 'en' ? 'en' : 'fr',
})

const localeItems = computed(() => [
  { label: t('locales.fr'), value: 'fr' },
  { label: t('locales.en'), value: 'en' },
])

watch(
  () => state.locale,
  async (selected) => {
    await setLocale(selected)
  },
)

onMounted(async () => {
  if (token === null) {
    return
  }
  try {
    const response = await apiCall(
      'POST',
      '/auth/invitation/check',
      invitationStatusResponseSchema,
      { token },
    )
    email.value = response.email
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    checking.value = false
  }
})

async function submit(): Promise<void> {
  if (token === null) {
    return
  }
  pending.value = true
  failure.value = null
  try {
    const profile = await apiCall(
      'POST',
      '/auth/invitation/accept',
      userProfileSchema,
      { token, password: state.password, locale: state.locale },
    )
    resetCsrfToken()
    session.setUser(profile)
    await navigateTo('/')
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-base font-semibold text-highlighted">
      {{ t('invitation.title') }}
    </h1>
    <UAlert
      v-if="failure"
      :title="failure"
      :icon="icons.error"
      color="error"
      variant="soft"
      data-testid="invitation-error"
    />
    <p v-if="checking" class="text-sm text-muted">
      {{ t('invitation.checking') }}
    </p>
    <UForm
      v-else-if="email !== null"
      :state="state"
      :validate="validator(acceptInvitationFormSchema)"
      :validate-on="['blur']"
      class="flex flex-col gap-4"
      data-testid="invitation-form"
      @submit="submit"
    >
      <p class="text-sm text-muted">
        {{ t('invitation.intro', { email }) }}
      </p>
      <AppFormField :label="t('profile.language')" name="locale">
        <USelect
          v-model="state.locale"
          :items="localeItems"
          class="w-full"
          data-testid="invitation-locale"
        />
      </AppFormField>
      <AppFormField
        :label="t('auth.newPassword')"
        :hint="t('auth.passwordRule')"
        name="password"
      >
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="new-password"
          class="w-full"
          data-testid="invitation-password"
        />
      </AppFormField>
      <AppFormField :label="t('auth.passwordConfirmation')" name="confirmation">
        <UInput
          v-model="state.confirmation"
          type="password"
          autocomplete="new-password"
          class="w-full"
          data-testid="invitation-confirmation"
        />
      </AppFormField>
      <UButton
        type="submit"
        :label="t('invitation.submit')"
        :loading="pending"
        color="primary"
        variant="solid"
        block
        data-testid="invitation-submit"
      />
    </UForm>
  </div>
</template>
