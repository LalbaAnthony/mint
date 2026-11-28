<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui'

const open = defineModel<boolean>('open', { required: true })

const { t } = useI18n()
const route = useRoute()
const { moreEntries } = useNavigation()

const items = computed<NavigationMenuItem[]>(() =>
  moreEntries.value.map(({ label, icon, to }) => ({ label, icon, to })),
)

watch(
  () => route.fullPath,
  () => {
    open.value = false
  },
)
</script>

<template>
  <UDrawer v-model:open="open" :title="t('navigation.more')">
    <template #body>
      <UNavigationMenu
        :items="items"
        orientation="vertical"
        data-testid="more-navigation"
      />
    </template>
  </UDrawer>
</template>
