<template>
  <main
    class="flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-12"
  >
    <AppBrand variant="login" />
    <UCard class="w-full max-w-sm">
      <slot />
    </UCard>
  </main>
</template>
