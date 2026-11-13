import type { PageAccess } from './session'

declare module '#app' {
  interface PageMeta {
    hideFab?: boolean
    access?: PageAccess
  }
}

export {}
