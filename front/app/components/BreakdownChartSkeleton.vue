<script setup lang="ts">
import type { BreakdownGroup } from '~~/types/dashboard'

const { t } = useI18n()

const groups = ['needs', 'wants', 'save'] as const satisfies BreakdownGroup[]
</script>

<template>
  <div
    class="flex flex-col gap-4 lg:flex-row lg:items-start"
    data-testid="breakdown-skeleton"
  >
    <div class="flex flex-col gap-2 lg:flex-1">
      <SkeletonChart :height="chartHeights.breakdown" />
      <div class="flex flex-wrap gap-2">
        <SkeletonControl kind="button" size="sm" class="w-32" />
        <SkeletonControl kind="button" size="sm" class="w-32" />
        <SkeletonControl kind="button" size="sm" class="w-40" />
      </div>
    </div>
    <table class="w-full text-sm lg:w-80">
      <thead>
        <tr class="text-left text-xs font-medium text-muted">
          <th class="py-1">{{ t('dashboard.group') }}</th>
          <th class="py-1 text-right">{{ t('dashboard.actual') }}</th>
          <th class="py-1 text-right">{{ t('dashboard.target') }}</th>
          <th class="py-1 text-right">{{ t('dashboard.gap') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="group in groups"
          :key="group"
          class="border-t border-default"
        >
          <td class="py-1">
            <span class="flex items-center gap-2">
              <DataDot :tone="group" />
              {{ t(`groups.${group}`) }}
            </span>
            <SkeletonAmount concealable class="text-xs" />
          </td>
          <td class="py-1">
            <SkeletonText width="xs" align="end" />
          </td>
          <td class="py-1">
            <SkeletonText width="xs" align="end" />
          </td>
          <td class="py-1">
            <SkeletonText width="xs" align="end" />
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
