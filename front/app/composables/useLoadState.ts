import type {
  LoadMode,
  LoadPhase,
  LoadState,
  LoadStateOptions,
  Loader,
} from '~~/types/skeleton'

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

export function useLoadState(options: LoadStateOptions = {}): LoadState {
  const delayMs = options.delayMs ?? skeletonDelayMs
  const minimumMs = options.minimumMs ?? skeletonMinimumMs

  const phase = ref<LoadPhase>('pending')
  const loading = ref(false)
  const settled = ref(false)

  let latestRun = 0
  let lastLoader: Loader | null = null
  let delayTimer: ReturnType<typeof setTimeout> | undefined
  let minimumDisplay: Promise<void> | null = null

  function clearDelay(): void {
    clearTimeout(delayTimer)
    delayTimer = undefined
  }

  function showSkeletonLater(): void {
    if (phase.value === 'skeleton' || delayTimer !== undefined) {
      return
    }
    delayTimer = setTimeout(() => {
      delayTimer = undefined
      if (loading.value) {
        phase.value = 'skeleton'
        minimumDisplay = wait(minimumMs)
      }
    }, delayMs)
  }

  async function run(
    loader: Loader,
    mode: LoadMode = 'context',
  ): Promise<void> {
    const current = ++latestRun
    lastLoader = loader
    loading.value = true
    if (mode === 'context') {
      showSkeletonLater()
    }
    let failed = false
    try {
      await loader()
    } catch (error) {
      failed = true
      options.onError?.(error)
    }
    if (current !== latestRun) {
      return
    }
    clearDelay()
    if (minimumDisplay !== null) {
      await minimumDisplay
      if (current !== latestRun) {
        return
      }
      minimumDisplay = null
    }
    loading.value = false
    settled.value = true
    if (!failed) {
      phase.value = 'ready'
    } else if (mode === 'context' || phase.value !== 'ready') {
      phase.value = 'error'
    }
  }

  function retry(): Promise<void> {
    if (lastLoader === null) {
      return Promise.resolve()
    }
    return run(lastLoader, 'context')
  }

  onScopeDispose(() => {
    latestRun += 1
    clearDelay()
  })

  return reactive({
    phase: computed(() => phase.value),
    loading: computed(() => loading.value),
    settled: computed(() => settled.value),
    run,
    retry,
  })
}
