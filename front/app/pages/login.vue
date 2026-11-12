<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()

useHead({ title: () => t('auth.login') })
</script>

<template>
  <h1 class="sr-only">{{ t('auth.login') }}</h1>
</template>
