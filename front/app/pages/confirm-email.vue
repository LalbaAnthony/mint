<script setup lang="ts">
definePageMeta({ layout: 'auth', access: 'public' })

const { t } = useI18n()
const route = useRoute()
const session = useSessionStore()
const { errorMessage } = useFormValidation()

useHead({ title: () => t('emailChange.title') })

const token = readHashToken(route.hash)
const confirmed = ref(false)
const failure = ref<string | null>(
  token === null ? t('errors.token_invalid') : null,
)

onMounted(async () => {
  if (token === null) {
    return
  }
  try {
    await apiCommand('POST', '/auth/email-change/confirm', { token })
    confirmed.value = true
    if (session.status === 'authenticated') {
      await session.load()
    }
  } catch (error) {
    failure.value = errorMessage(error)
  }
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <h1 class="text-base font-semibold text-highlighted">
      {{ t('emailChange.title') }}
    </h1>
    <UAlert
      v-if="confirmed"
      :title="t('emailChange.confirmed')"
      :icon="icons.success"
      color="success"
      variant="soft"
      data-testid="email-confirmed"
    />
    <UAlert
      v-else-if="failure"
      :title="failure"
      :icon="icons.error"
      color="error"
      variant="soft"
      data-testid="email-confirm-error"
    />
    <p v-else class="text-sm text-muted">{{ t('emailChange.confirming') }}</p>
    <NuxtLink
      :to="session.status === 'authenticated' ? '/profile' : '/login'"
      class="text-sm text-primary underline"
    >
      {{
        session.status === 'authenticated'
          ? t('navigation.profileAndPreferences')
          : t('auth.backToLogin')
      }}
    </NuxtLink>
  </div>
</template>
