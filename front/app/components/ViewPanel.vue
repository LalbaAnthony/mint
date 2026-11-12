<script setup lang="ts">
import type { ViewPanelProps } from '~~/types/components'

const props = defineProps<ViewPanelProps>()

const { t } = useI18n()

useHead({ title: () => props.title })
</script>

<template>
  <UDashboardPanel
    :ui="{ body: 'max-lg:pb-[calc(152px+env(safe-area-inset-bottom))]' }"
  >
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
        </template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <slot />
    </template>
  </UDashboardPanel>
</template>
