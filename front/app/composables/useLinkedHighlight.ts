import { useEventListener } from '@vueuse/core'

function linkedElement(): Element | null {
  return document.querySelector(`[${linkedTargetAttribute}]`)
}

export function useLinkedHighlight(queryKey: string) {
  const route = useRoute()
  const router = useRouter()
  const highlightedId = ref<string | null>(null)

  async function take(): Promise<string | null> {
    const id = route.query[queryKey]
    if (typeof id !== 'string') {
      return null
    }
    highlightedId.value = id
    await router.replace({ query: {} })
    return id
  }

  async function reveal(): Promise<void> {
    await nextTick()
    let element = linkedElement()
    if (element === null) {
      await nextTick()
      element = linkedElement()
    }
    element?.scrollIntoView({ block: 'center' })
  }

  useEventListener(
    document,
    'pointerdown',
    (event) => {
      if (highlightedId.value === null) {
        return
      }
      const element = linkedElement()
      if (
        element === null ||
        !(event.target instanceof Node) ||
        !element.contains(event.target)
      ) {
        highlightedId.value = null
      }
    },
    { capture: true },
  )

  return { highlightedId, take, reveal }
}
