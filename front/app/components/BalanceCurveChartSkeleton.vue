<template>
  <div class="flex flex-col gap-3" data-testid="balance-curve-skeleton">
    <SkeletonChart :height="chartHeights.balanceCurve" />
    <div class="flex justify-end">
      <SkeletonControl kind="button" class="w-48" />
    </div>
  </div>
</template>
