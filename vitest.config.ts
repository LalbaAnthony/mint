import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    testTimeout: 30_000,
    projects: [
      {
        extends: true,
        test: {
          name: 'scripts',
          include: ['scripts/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'api',
          include: ['api/**/*.test.ts'],
          globalSetup: ['api/tests/global-setup.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['scripts/**/*.ts', 'api/**/*.ts'],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'api/tests/**', 'api/dist/**'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
