<script setup lang="ts">
import type { AppBrandProps } from '~~/types/components'

withDefaults(defineProps<AppBrandProps>(), { collapsed: false })

const { t } = useI18n()
</script>

<template>
  <NuxtLink
    v-if="variant === 'sidebar'"
    to="/"
    :aria-label="t('app.homeLink')"
    class="flex min-w-0 items-center gap-2 rounded-md"
  >
    <img src="/logo.svg" alt="" class="size-7 shrink-0" />
    <span
      v-if="!collapsed"
      class="truncate text-lg font-bold tracking-tight text-highlighted"
    >
      {{ t('app.name') }}
    </span>
  </NuxtLink>
  <div v-else class="flex items-center gap-2">
    <img src="/logo.svg" alt="" class="size-12 shrink-0" />
    <span class="text-3xl font-bold tracking-tight text-highlighted">
      {{ t('app.name') }}
    </span>
  </div>
</template>
