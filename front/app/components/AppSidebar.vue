<script setup lang="ts">
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
  },
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

      <UDropdownMenu :items="quickAddItems" :content="{ align: 'start' }">
        <UButton
          :label="collapsed ? undefined : t('quickAdd.add')"
          :aria-label="collapsed ? t('quickAdd.add') : undefined"
          :icon="icons.add"
          color="primary"
          variant="solid"
          block
          data-testid="sidebar-quick-add"
        />
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

      <UDashboardSidebarCollapse />
    </template>
  </UDashboardSidebar>
</template>
