<script setup lang="ts">
import type { LoadErrorEmits } from '~~/types/skeleton'

const emit = defineEmits<LoadErrorEmits>()

const { t } = useI18n()
</script>

<template>
  <EmptyState
    :icon="icons.loadError"
    :title="t('loading.errorTitle')"
    :description="t('loading.errorText')"
    data-testid="load-error"
  >
    <UButton
      :label="t('loading.retry')"
      :icon="icons.reload"
      color="primary"
      variant="soft"
      data-testid="load-error-retry"
      @click="emit('retry')"
    />
  </EmptyState>
</template>
