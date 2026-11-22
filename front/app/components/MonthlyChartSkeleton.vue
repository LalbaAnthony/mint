<template>
  <div class="flex flex-col gap-3" data-testid="monthly-skeleton">
    <SkeletonChart :height="chartHeights.monthly" />
    <div class="flex justify-end">
      <SkeletonControl kind="button" class="w-48" />
    </div>
  </div>
</template>
