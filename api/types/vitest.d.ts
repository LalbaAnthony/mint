import type { DatabaseEnvironment } from './environment.js'

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabase: DatabaseEnvironment
  }
}
