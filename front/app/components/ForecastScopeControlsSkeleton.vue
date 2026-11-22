<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div
    class="flex flex-wrap items-end gap-2"
    aria-hidden="true"
    data-testid="forecast-scope-skeleton"
  >
    <UFormField :label="t('forecast.scope')" class="min-w-48 flex-1">
      <SkeletonControl kind="field" class="w-full" />
    </UFormField>
    <UFormField :label="t('forecast.horizon')" class="w-32">
      <SkeletonControl kind="field" class="w-full" />
    </UFormField>
  </div>
</template>
