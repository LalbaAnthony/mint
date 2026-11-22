<template>
  <UCard :ui="{ body: 'p-0 sm:p-0' }" data-testid="account-group-skeleton">
    <template #header>
      <div class="flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-2 text-base font-semibold">
          <SkeletonCircle :size="10" />
          <SkeletonText width="md" />
        </div>
        <SkeletonAmount concealable class="text-base font-semibold" />
      </div>
    </template>
    <ul class="divide-y divide-default">
      <li v-for="index in skeletonIndexes()" :key="index" class="px-2 sm:px-4">
        <ListRow as="div">
          <SkeletonControl kind="touch-icon-button" />
          <div class="min-w-0 flex-1">
            <SkeletonText :width="skeletonRowWidth(index)" class="text-sm" />
            <SkeletonText width="sm" class="text-xs" />
          </div>
          <SkeletonAmount concealable class="text-sm font-semibold" />
          <SkeletonControl kind="touch-icon-button" />
        </ListRow>
      </li>
    </ul>
  </UCard>
</template>
