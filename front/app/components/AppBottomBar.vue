<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { mainEntries, isMoreActive } = useNavigation()

const isMoreOpen = ref(false)

const entryClass =
  'flex h-full flex-col items-center justify-center gap-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset'
const pillClass = 'flex h-8 w-14 items-center justify-center rounded-full'
</script>

<template>
  <nav
    :aria-label="t('navigation.main')"
    class="fixed inset-x-0 bottom-0 z-10 border-t border-default bg-default pb-[env(safe-area-inset-bottom)] lg:hidden"
    data-testid="bottom-bar"
  >
    <ul class="grid h-16 grid-cols-5">
      <li v-for="entry in mainEntries" :key="entry.id">
        <NuxtLink
          :to="entry.to"
          :class="[
            entryClass,
            isRouteActive(route.path, entry.to) ? 'text-primary' : 'text-muted',
          ]"
          :aria-current="
            isRouteActive(route.path, entry.to) ? 'page' : undefined
          "
          :data-testid="`bottom-bar-${entry.id}`"
        >
          <span
            :class="[
              pillClass,
              { 'bg-primary/10': isRouteActive(route.path, entry.to) },
            ]"
          >
            <UIcon :name="entry.icon" class="size-6" />
          </span>
          <span class="text-xs font-medium">{{ entry.label }}</span>
        </NuxtLink>
      </li>
      <li>
        <button
          type="button"
          :class="[
            entryClass,
            'w-full',
            isMoreActive ? 'text-primary' : 'text-muted',
          ]"
          aria-haspopup="dialog"
          :aria-expanded="isMoreOpen"
          data-testid="bottom-bar-more"
          @click="isMoreOpen = true"
        >
          <span :class="[pillClass, { 'bg-primary/10': isMoreActive }]">
            <UIcon :name="icons.more" class="size-6" />
          </span>
          <span class="text-xs font-medium">{{ t('navigation.more') }}</span>
        </button>
      </li>
    </ul>
    <AppMoreDrawer v-model:open="isMoreOpen" />
  </nav>
</template>
