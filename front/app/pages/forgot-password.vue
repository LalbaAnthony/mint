<script setup lang="ts">
import { passwordResetRequestSchema } from '@mint/shared/schemas/auth'

definePageMeta({ layout: 'auth', access: 'guest' })

const { t } = useI18n()
const { validator, errorMessage } = useFormValidation()

useHead({ title: () => t('auth.forgotPasswordTitle') })

const state = reactive({ email: '' })
const pending = ref(false)
const sent = ref(false)
const failure = ref<string | null>(null)

async function submit(): Promise<void> {
  pending.value = true
  failure.value = null
  try {
    await apiCommand('POST', '/auth/password-reset/request', {
      email: state.email.trim(),
    })
    sent.value = true
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
      {{ t('auth.forgotPasswordTitle') }}
    </h1>
    <UAlert
      v-if="sent"
      :title="t('auth.resetLinkSent')"
      :icon="icons.success"
      color="success"
      variant="soft"
      data-testid="reset-link-sent"
    />
    <template v-else>
      <p class="text-sm text-muted">{{ t('auth.forgotPasswordHelp') }}</p>
      <UAlert
        v-if="failure"
        :title="failure"
        :icon="icons.error"
        color="error"
        variant="soft"
      />
      <UForm
        :state="state"
        :validate="validator(passwordResetRequestSchema)"
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
          />
        </AppFormField>
        <UButton
          type="submit"
          :label="t('auth.sendResetLink')"
          :loading="pending"
          color="primary"
          variant="solid"
          block
        />
      </UForm>
    </template>
    <NuxtLink to="/login" class="text-sm text-primary underline">
      {{ t('auth.backToLogin') }}
    </NuxtLink>
  </div>
</template>
