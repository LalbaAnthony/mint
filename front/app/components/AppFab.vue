<script setup lang="ts">
import { useOnline } from '@vueuse/core'

const { t } = useI18n()
const route = useRoute()
const isOnline = useOnline()
const { quickAddEntries } = useNavigation()

const isOpen = ref(false)
const isHidden = computed(() => route.meta.hideFab === true)
</script>

<template>
  <UDrawer v-if="!isHidden" v-model:open="isOpen" :title="t('quickAdd.title')">
    <UButton
      :icon="icons.add"
      :aria-label="t('quickAdd.add')"
      :disabled="!isOnline"
      color="primary"
      variant="solid"
      class="fixed right-4 bottom-[calc(64px+16px+env(safe-area-inset-bottom))] z-10 size-14 justify-center rounded-full shadow-lg lg:hidden"
      data-testid="fab"
    />

    <template #body>
      <ul class="flex flex-col gap-1" data-testid="fab-actions">
        <li v-for="entry in quickAddEntries" :key="entry.kind">
          <UButton
            :label="entry.label"
            :icon="entry.icon"
            :disabled="entry.disabled"
            color="neutral"
            variant="ghost"
            block
            class="justify-start"
          />
        </li>
      </ul>
    </template>
  </UDrawer>
</template>
