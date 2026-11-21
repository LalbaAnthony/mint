export const amountMaskStorageKey = 'mint:masked-amounts'

const maskedValue = '1'

function readStoredMask(): boolean {
  try {
    return window.localStorage.getItem(amountMaskStorageKey) === maskedValue
  } catch {
    return false
  }
}

function writeStoredMask(masked: boolean): boolean {
  try {
    if (masked) {
      window.localStorage.setItem(amountMaskStorageKey, maskedValue)
    } else {
      window.localStorage.removeItem(amountMaskStorageKey)
    }
    return true
  } catch {
    return false
  }
}

export const useAmountMaskStore = defineStore('amount-mask', () => {
  const masked = ref(import.meta.client ? readStoredMask() : false)
  const toast = useToast()
  const i18n = useNuxtApp().$i18n

  function apply(next: boolean): void {
    masked.value = next
    if (!writeStoredMask(next)) {
      toast.add({
        title: i18n.t('amountMask.saveFailed'),
        icon: icons.error,
        color: 'error',
      })
    }
  }

  function toggle(): void {
    apply(!masked.value)
  }

  function forget(): void {
    apply(false)
  }

  if (import.meta.client) {
    window.addEventListener('storage', (event) => {
      if (event.key === amountMaskStorageKey || event.key === null) {
        masked.value = event.newValue === maskedValue
      }
    })
  }

  return { masked, toggle, forget }
})
