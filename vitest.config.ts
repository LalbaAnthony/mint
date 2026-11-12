import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
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
          name: 'front-scripts',
          include: ['front/scripts/**/*.test.ts'],
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
      await defineVitestProject({
        test: {
          name: 'front',
          include: ['front/test/**/*.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          environment: 'nuxt',
          environmentOptions: {
            nuxt: {
              rootDir: fileURLToPath(new URL('./front', import.meta.url)),
            },
          },
        },
      }),
    ],
    coverage: {
      provider: 'v8',
      include: [
        'scripts/**/*.ts',
        'api/**/*.ts',
        'front/app/**/*.{ts,vue}',
        'front/scripts/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts', 'api/tests/**', 'api/dist/**'],
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
