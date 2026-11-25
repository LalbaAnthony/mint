<script setup lang="ts">
import type { QuickAddKind } from '~~/types/navigation'

const { t } = useI18n()
const connectivity = useConnectivityStore()
const { quickAddEntries } = useNavigation()
const editor = useOperationEditorStore()
const quickAdd = useQuickAddStore()
const hint = useShortcutHint('create', { fallbackOnly: true })
const { addVisible } = useFloatingButtons()

function choose(kind: QuickAddKind): void {
  quickAdd.drawerOpen = false
  editor.create(kind)
}
</script>

<template>
  <UDrawer
    v-if="addVisible"
    v-model:open="quickAdd.drawerOpen"
    :title="t('quickAdd.title')"
  >
    <ShortcutTooltip :hint="hint" :text="t('quickAdd.add')">
      <UButton
        :icon="icons.add"
        :aria-label="t('quickAdd.add')"
        :disabled="connectivity.offline"
        color="primary"
        variant="solid"
        class="fixed right-4 bottom-[calc(64px+16px+env(safe-area-inset-bottom))] z-10 size-14 justify-center rounded-full shadow-lg lg:hidden"
        data-testid="add-fab"
      />
    </ShortcutTooltip>

    <template #body>
      <ul class="flex flex-col gap-1" data-testid="add-fab-actions">
        <li v-for="entry in quickAddEntries" :key="entry.kind">
          <UButton
            :label="entry.label"
            :icon="entry.icon"
            :disabled="entry.disabled"
            color="neutral"
            variant="ghost"
            block
            class="justify-start"
            :data-testid="`add-fab-${entry.kind}`"
            @click="choose(entry.kind)"
          />
        </li>
      </ul>
    </template>
  </UDrawer>
</template>
