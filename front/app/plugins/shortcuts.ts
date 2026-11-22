export default defineNuxtPlugin(() => {
  const shortcuts = useShortcutsStore()
  window.addEventListener('keydown', (event) => shortcuts.handleKeydown(event))
})
