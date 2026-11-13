import { fileURLToPath } from 'node:url'
import { defineVitestProject } from '@nuxt/test-utils/config'
import { defineConfig } from 'vitest/config'

const sharedSourceDirectory = fileURLToPath(
  new URL('./shared', import.meta.url),
)

export default defineConfig({
  resolve: {
    alias: { '@mint/shared': sharedSourceDirectory },
  },
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
          name: 'shared',
          include: ['shared/**/*.test.ts'],
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
          setupFiles: ['front/test/setup.ts'],
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
        'shared/**/*.ts',
        'front/app/**/*.{ts,vue}',
        'front/scripts/**/*.ts',
      ],
      exclude: [
        '**/*.test.ts',
        '**/*.d.ts',
        'api/tests/**',
        'api/dist/**',
        'shared/dist/**',
      ],
      reporter: ['text', 'html', 'lcov'],
    },
  },
})
