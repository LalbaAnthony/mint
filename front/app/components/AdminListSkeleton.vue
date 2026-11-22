<template>
  <SkeletonList
    :row="{ gap: 3, padding: 3, flush: true, wrap: true, spread: true }"
    class="divide-y divide-default"
  >
    <template #default="{ index }">
      <div class="flex min-w-0 flex-col gap-1">
        <div class="flex flex-wrap items-center gap-2">
          <SkeletonText :width="skeletonRowWidth(index)" class="text-sm" />
          <SkeletonControl kind="badge" class="w-16" />
        </div>
        <SkeletonText width="xl" class="text-xs" />
      </div>
      <SkeletonControl kind="button" class="w-24" />
    </template>
  </SkeletonList>
</template>
