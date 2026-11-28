<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import type { NavigationEntry, QuickAddEntry } from '~~/types/navigation'

const { t } = useI18n()
const {
  mainEntries,
  planningEntries,
  toolEntries,
  secondaryEntries,
  quickAddEntries,
} = useNavigation()
const editor = useOperationEditorStore()
const connectivity = useConnectivityStore()
const quickAdd = useQuickAddStore()
const isDesktopLayout = useMediaQuery('(min-width: 1024px)')

const collapsed = ref(false)
const sidebarHint = useShortcut(
  'sidebar',
  () => {
    collapsed.value = !collapsed.value
  },
  { enabled: isDesktopLayout },
)
const quickAddHint = useShortcutHint('create', { fallbackOnly: true })

function toNavigationItems(entries: NavigationEntry[]): NavigationMenuItem[] {
  return entries.map(({ label, icon, to }) => ({ label, icon, to }))
}

function toQuickAddItems(entries: QuickAddEntry[]): DropdownMenuItem[] {
  return entries.map(({ kind, label, icon, disabled }) => ({
    label,
    icon,
    disabled: disabled || connectivity.offline,
    onSelect: () => editor.create(kind),
  }))
}

const navigationLists = computed(() => [
  toNavigationItems(mainEntries.value),
  toNavigationItems(planningEntries.value),
  toNavigationItems(toolEntries.value),
])

const secondaryItems = computed(() => toNavigationItems(secondaryEntries.value))

const quickAddItems = computed(() => toQuickAddItems(quickAddEntries.value))
</script>

<template>
  <UDashboardSidebar
    v-model:collapsed="collapsed"
    collapsible
    :default-size="256"
    :min-size="256"
    :max-size="256"
    :collapsed-size="64"
    :toggle="false"
    :ui="{ root: 'bg-default', footer: 'flex-col items-stretch gap-1' }"
    role="banner"
  >
    <template #header="{ collapsed }">
      <AppBrand variant="sidebar" :collapsed="collapsed" />
    </template>

    <template #default="{ collapsed }">
      <AppSearchTrigger :collapsed="collapsed" />

      <UDropdownMenu
        v-model:open="quickAdd.menuOpen"
        :items="quickAddItems"
        :content="{ align: 'start' }"
      >
        <ShortcutTooltip :hint="quickAddHint" :text="t('quickAdd.add')">
          <UButton
            :label="collapsed ? undefined : t('quickAdd.add')"
            :aria-label="collapsed ? t('quickAdd.add') : undefined"
            :icon="icons.add"
            color="primary"
            variant="solid"
            block
            data-testid="sidebar-quick-add"
          />
        </ShortcutTooltip>
      </UDropdownMenu>

      <UNavigationMenu
        :items="navigationLists"
        :collapsed="collapsed"
        orientation="vertical"
        tooltip
        :aria-label="t('navigation.main')"
        data-testid="sidebar-navigation"
      />
    </template>

    <template #footer="{ collapsed }">
      <UNavigationMenu
        :items="secondaryItems"
        :collapsed="collapsed"
        orientation="vertical"
        tooltip
        :aria-label="t('navigation.secondary')"
        data-testid="sidebar-secondary-navigation"
      />

      <ShortcutTooltip
        :hint="sidebarHint"
        :text="t('shortcuts.actions.sidebar')"
      >
        <UDashboardSidebarCollapse
          :class="collapsed ? undefined : 'px-2.5'"
          data-testid="sidebar-collapse"
        />
      </ShortcutTooltip>
    </template>
  </UDashboardSidebar>
</template>
