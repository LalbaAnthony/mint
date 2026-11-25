<script setup lang="ts">
import type { ViewPanelProps } from '~~/types/components'

const props = defineProps<ViewPanelProps>()

const { t } = useI18n()
const { formatDateTime } = useFormatters()
const connectivity = useConnectivityStore()
const { addVisible, searchVisible } = useFloatingButtons()

const bodyClass = computed(() => {
  if (searchVisible.value) {
    return 'max-lg:pb-[calc(64px+16px+56px+16px+56px+16px+env(safe-area-inset-bottom))]'
  }
  if (addVisible.value) {
    return 'max-lg:pb-[calc(64px+16px+56px+16px+env(safe-area-inset-bottom))]'
  }
  return 'max-lg:pb-[calc(64px+16px+env(safe-area-inset-bottom))]'
})

const offlineTitle = computed(() =>
  connectivity.dataAt === null
    ? t('offline.bannerNoData')
    : t('offline.banner', { date: formatDateTime(connectivity.dataAt) }),
)

useHead({ title: () => props.title })
</script>

<template>
  <UDashboardPanel :ui="{ body: bodyClass }">
    <template #header>
      <UDashboardNavbar
        :title="title"
        :toggle="false"
        :ui="{
          root: 'h-14 bg-default lg:h-(--ui-header-height)',
          title: 'text-lg',
        }"
      >
        <template #leading>
          <NuxtLink
            to="/"
            :aria-label="t('app.homeLink')"
            class="shrink-0 rounded-md lg:hidden"
          >
            <img src="/logo.svg" alt="" class="size-6" />
          </NuxtLink>
        </template>
        <template #right>
          <slot name="actions" />
          <AmountMaskToggle />
          <NotificationBell />
        </template>
      </UDashboardNavbar>
      <UAlert
        v-if="connectivity.offline"
        :icon="icons.offline"
        :title="offlineTitle"
        color="info"
        variant="soft"
        class="rounded-none"
        role="status"
        data-testid="offline-banner"
      />
    </template>
    <template #body>
      <slot />
    </template>
  </UDashboardPanel>
</template>
