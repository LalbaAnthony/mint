<script setup lang="ts">
import { loginRequestSchema } from '@mint/shared/schemas/auth'

definePageMeta({ layout: 'auth', access: 'guest' })

const { t } = useI18n()
const route = useRoute()
const session = useSessionStore()
const { validator, errorMessage } = useFormValidation()

useHead({ title: () => t('auth.login') })

const state = reactive({ email: '', password: '' })
const pending = ref(false)
const failure = ref<string | null>(null)

const passkeyAvailable = ref(false)
const passkeyPending = ref(false)

onMounted(() => {
  passkeyAvailable.value = passkeysSupported()
})

async function submitPasskey(): Promise<void> {
  passkeyPending.value = true
  failure.value = null
  try {
    if (await session.loginWithPasskey()) {
      await navigateTo(safeRedirect(route.query.redirect))
    }
  } catch (error) {
    failure.value = errorMessage(error)
  } finally {
    passkeyPending.value = false
  }
}

async function submit(): Promise<void> {
  pending.value = true
  failure.value = null
  try {
    await session.login(state.email.trim(), state.password)
    await navigateTo(safeRedirect(route.query.redirect))
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
      {{ t('auth.login') }}
    </h1>
    <UAlert
      v-if="failure"
      :title="failure"
      :icon="icons.error"
      color="error"
      variant="soft"
      data-testid="login-error"
    />
    <UForm
      :state="state"
      :validate="validator(loginRequestSchema)"
      :validate-on="['blur']"
      class="flex flex-col gap-4"
      @submit="submit"
    >
      <AppFormField :label="t('auth.email')" name="email">
        <UInput
          v-model.trim="state.email"
          type="email"
          autocomplete="username"
          class="w-full"
          data-testid="login-email"
        />
      </AppFormField>
      <AppFormField :label="t('auth.password')" name="password">
        <UInput
          v-model="state.password"
          type="password"
          autocomplete="current-password"
          class="w-full"
          data-testid="login-password"
        />
      </AppFormField>
      <UButton
        type="submit"
        :label="t('auth.submitLogin')"
        :loading="pending"
        color="primary"
        variant="solid"
        block
        data-testid="login-submit"
      />
    </UForm>
    <template v-if="passkeyAvailable">
      <USeparator :label="t('auth.or')" />
      <UButton
        :label="t('auth.passkeyLogin')"
        :icon="icons.passkey"
        :loading="passkeyPending"
        color="neutral"
        variant="outline"
        block
        data-testid="login-passkey"
        @click="submitPasskey"
      />
    </template>
    <NuxtLink
      to="/forgot-password"
      class="text-sm text-primary underline"
      data-testid="forgot-password-link"
    >
      {{ t('auth.forgotPassword') }}
    </NuxtLink>
  </div>
</template>
