<script setup lang="ts">
useNotificationRefresh()
useOfflineSync()
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
  </UDashboardGroup>
</template>
