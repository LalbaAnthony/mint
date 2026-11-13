import type { TestDatabaseServer } from './tests.js'

declare module 'vitest' {
  export interface ProvidedContext {
    testDatabaseServer: TestDatabaseServer
  }
}
