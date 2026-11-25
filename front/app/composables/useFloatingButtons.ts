export function useFloatingButtons() {
  const route = useRoute()

  const addVisible = computed(() => route.meta.hideFab !== true)
  const searchVisible = computed(
    () => addVisible.value && !isRouteActive(route.path, searchPagePath),
  )

  return { addVisible, searchVisible }
}
