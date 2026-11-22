<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div role="status" aria-busy="true" data-testid="skeleton-zone">
    <span class="sr-only">{{ t('loading.label') }}</span>
    <div class="contents" aria-hidden="true">
      <slot />
    </div>
  </div>
</template>
