<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <StatGrid :columns="4" data-testid="dashboard-banner-skeleton">
    <UCard>
      <div class="flex items-center gap-2 text-sm font-medium text-muted">
        <UIcon :name="icons.belowThreshold" class="size-5 text-warning" />
        <SkeletonText width="md" />
      </div>
      <SkeletonText width="full" :lines="2" class="mt-2 text-sm" />
    </UCard>
    <UCard>
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 text-sm font-medium text-muted">
          <UIcon :name="icons.manualMode" class="size-5" />
          {{ t('dashboard.manualPayments') }}
        </span>
        <SkeletonBlock shape="round" class="h-4 w-7" />
      </div>
    </UCard>
    <UCard>
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 text-sm font-medium text-muted">
          <UIcon :name="icons.uncategorized" class="size-5" />
          {{ t('dashboard.toCategorize') }}
        </span>
        <SkeletonBlock shape="round" class="h-4 w-7" />
      </div>
    </UCard>
    <UCard>
      <div class="flex items-center justify-between gap-2">
        <span class="flex items-center gap-2 text-sm font-medium text-muted">
          <UIcon :name="icons.reconciled" class="size-5" />
          {{ t('dashboard.proposals') }}
        </span>
        <SkeletonBlock shape="round" class="h-4 w-7" />
      </div>
    </UCard>
  </StatGrid>
</template>
