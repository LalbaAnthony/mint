<script setup lang="ts">
useNotificationRefresh()
useOfflineSync()
useGlobalShortcuts()
</script>

<template>
  <UDashboardGroup unit="px">
    <AppSidebar />
    <main class="flex min-w-0 flex-1">
      <slot />
    </main>
    <AppBottomBar />
    <AppSearchFab />
    <AppFab />
    <GlobalSearchModal />
    <OperationFormModal />
    <ReconciliationProposalModal />
    <NotificationCenter />
    <ShortcutHelpModal />
  </UDashboardGroup>
</template>
