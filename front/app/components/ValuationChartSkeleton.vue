<template>
  <div class="flex flex-col gap-3" data-testid="valuation-chart-skeleton">
    <SkeletonChart :height="chartHeights.valuation" />
    <div class="flex justify-end">
      <SkeletonControl kind="button" class="w-48" />
    </div>
  </div>
</template>
