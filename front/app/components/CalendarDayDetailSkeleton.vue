<template>
  <section class="flex flex-col gap-4" data-testid="calendar-day-skeleton">
    <div class="flex flex-wrap items-baseline justify-between gap-2">
      <SkeletonText width="lg" class="text-base" />
      <SkeletonAmount concealable class="text-sm font-semibold" />
    </div>
    <div class="flex flex-col gap-1">
      <SkeletonText width="sm" class="text-sm" />
      <SkeletonList class="flex flex-col divide-y divide-default">
        <template #default="{ index }">
          <SkeletonCircle :size="16" />
          <div class="min-w-0 flex-1">
            <SkeletonText :width="skeletonRowWidth(index)" class="text-sm" />
          </div>
          <SkeletonAmount class="text-sm" />
        </template>
      </SkeletonList>
    </div>
  </section>
</template>
