<template>
  <UDashboardGroup unit="px">
    <AppSidebar />
    <main class="flex min-w-0 flex-1">
      <slot />
    </main>
    <AppBottomBar />
    <AppFab />
    <OperationFormModal />
  </UDashboardGroup>
</template>
