import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.ts'],
    testTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['scripts/**/*.ts'],
      exclude: ['scripts/**/*.test.ts'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
