<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { DropdownMenuItem, NavigationMenuItem } from '@nuxt/ui'
import type { NavigationEntry, QuickAddEntry } from '~~/types/navigation'

const { t } = useI18n()
const {
  mainEntries,
  planningEntries,
  toolEntries,
  profileEntry,
  administrationEntries,
  quickAddEntries,
} = useNavigation()
const logout = useLogout()
const editor = useOperationEditorStore()
const connectivity = useConnectivityStore()
const quickAdd = useQuickAddStore()
const shortcuts = useShortcutsStore()
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
const profileHint = useShortcutHint('profile')
const helpHint = useShortcutHint('help')

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

const administrationItems = computed(() =>
  toNavigationItems(administrationEntries.value),
)

const quickAddItems = computed(() => toQuickAddItems(quickAddEntries.value))

const profileItems = computed<DropdownMenuItem[]>(() => [
  {
    label: profileEntry.value.label,
    icon: profileEntry.value.icon,
    to: profileEntry.value.to,
    kbds: profileHint.value?.kbds,
  },
  ...(helpHint.value === undefined
    ? []
    : [
        {
          label: t('shortcuts.title'),
          icon: icons.keyboard,
          kbds: helpHint.value.kbds,
          onSelect: () => {
            shortcuts.helpOpen = true
          },
        },
      ]),
  {
    label: t('navigation.logout'),
    icon: icons.logout,
    disabled: connectivity.offline,
    onSelect: logout,
  },
])
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
      <UDropdownMenu
        :items="profileItems"
        :content="{ side: 'top', align: 'start' }"
      >
        <UButton
          :label="collapsed ? undefined : t('navigation.profile')"
          :aria-label="collapsed ? t('navigation.profile') : undefined"
          :icon="icons.profile"
          color="neutral"
          variant="ghost"
          block
          class="justify-start"
          data-testid="sidebar-profile"
        />
      </UDropdownMenu>

      <UNavigationMenu
        v-if="administrationItems.length > 0"
        :items="administrationItems"
        :collapsed="collapsed"
        orientation="vertical"
        tooltip
        :aria-label="t('navigation.administration')"
        data-testid="sidebar-administration"
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
