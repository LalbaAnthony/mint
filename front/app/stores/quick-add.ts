export const useQuickAddStore = defineStore('quick-add', () => {
  const menuOpen = ref(false)
  const drawerOpen = ref(false)

  return { menuOpen, drawerOpen }
})
