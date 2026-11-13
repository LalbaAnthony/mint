<script setup lang="ts">
import { newPasswordFormSchema } from '~~/schemas/forms'

definePageMeta({ layout: 'auth', access: 'public' })

const { t } = useI18n()
const route = useRoute()
const toast = useToast()
const session = useSessionStore()
const { validator, errorMessage } = useFormValidation()

useHead({ title: () => t('auth.resetPasswordTitle') })

const token = readHashToken(route.hash)
const state = reactive({ password: '', confirmation: '' })
const pending = ref(false)
const failure = ref<string | null>(
  token === null ? t('errors.token_invalid') : null,
)

async function submit(): Promise<void> {
  if (token === null) {
    return
  }
  pending.value = true
  failure.value = null
  try {
    await apiCommand('POST', '/auth/password-reset/confirm', {
      token,
      password: state.password,
    })
    session.clear()
    toast.add({
      title: t('auth.passwordChanged'),
      icon: icons.success,
      color: 'success',
    })
    await navigateTo('/login')
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
      {{ t('auth.resetPasswordTitle') }}
    </h1>
    <UAlert
      v-if="failure"
      :title="failure"
      :icon="icons.error"
      color="error"
      variant="soft"
      data-testid="reset-error"
    />
    <UForm
      v-if="token !== null"
      :state="state"
      :validate="validator(newPasswordFormSchema)"
      :validate-on="['blur']"
      class="flex flex-col gap-4"
      @submit="submit"
    >
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
        />
      </AppFormField>
      <AppFormField :label="t('auth.passwordConfirmation')" name="confirmation">
        <UInput
          v-model="state.confirmation"
          type="password"
          autocomplete="new-password"
          class="w-full"
        />
      </AppFormField>
      <UButton
        type="submit"
        :label="t('auth.savePassword')"
        :loading="pending"
        color="primary"
        variant="solid"
        block
      />
    </UForm>
    <NuxtLink to="/forgot-password" class="text-sm text-primary underline">
      {{ t('auth.requestNewLink') }}
    </NuxtLink>
  </div>
</template>
