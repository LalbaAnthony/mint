export const useSearchStore = defineStore('search', () => {
  const modalOpen = ref(false)

  function openModal(): void {
    modalOpen.value = true
  }

  function closeModal(): void {
    modalOpen.value = false
  }

  return { modalOpen, openModal, closeModal }
})
