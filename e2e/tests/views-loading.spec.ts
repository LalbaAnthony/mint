import { expect, test } from '@playwright/test'
import type { APIRequestContext, BrowserContextOptions } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  httpOrigin,
  login,
  openView,
  signedInViews,
} from '../support.ts'

const responseDelayMs = 800

const maximumLayoutShift = 0.1

const widths = [360, 768, 1024, 1280]

const contextOptions = {
  baseURL: httpOrigin,
  locale: 'fr-FR',
  timezoneId: 'Europe/Paris',
} satisfies BrowserContextOptions

const recordLayoutShift = `
  let worst = 0
  let sessionValue = 0
  let sessionStart = 0
  let previousShift = Number.NEGATIVE_INFINITY
  globalThis.mintLayoutShift = 0
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.hadRecentInput) {
        continue
      }
      if (
        entry.startTime - previousShift < 1000 &&
        entry.startTime - sessionStart < 5000
      ) {
        sessionValue += entry.value
      } else {
        sessionValue = entry.value
        sessionStart = entry.startTime
      }
      previousShift = entry.startTime
      worst = Math.max(worst, sessionValue)
      globalThis.mintLayoutShift = worst
    }
  }).observe({ type: 'layout-shift', buffered: true })
`

async function ensureAnAccount(request: APIRequestContext): Promise<void> {
  const overview = await request.get('/api/v1/accounts/overview')
  expect(overview.ok()).toBe(true)
  const groups: unknown = Reflect.get(await overview.json(), 'groups')
  if (Array.isArray(groups) && groups.length > 0) {
    return
  }
  const csrf = await request.get('/api/v1/csrf')
  const token: unknown = Reflect.get(await csrf.json(), 'token')
  expect(typeof token).toBe('string')
  const created = await request.post('/api/v1/accounts', {
    headers: { 'X-CSRF-Token': String(token) },
    data: {
      name: 'Compte de chargement',
      nature: 'current_account',
      regulatedProduct: null,
      usage: 'current',
      institution: null,
      initialBalanceCents: 150_000,
      initialBalanceDate: '2026-01-01',
      lowBalanceThresholdCents: null,
    },
  })
  expect(created.ok()).toBe(true)
}

test.describe('CHG-47, CHG-48: the views do not shift while they load', () => {
  let session: BrowserContextOptions['storageState']

  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext(contextOptions)
    const page = await context.newPage()
    await login(page, administratorEmail, administratorPassword)
    await expect(page).toHaveURL('/')
    await ensureAnAccount(context.request)
    session = await context.storageState()
    await context.close()
  })

  for (const width of widths) {
    test(`signed-in views at ${width} px`, async ({ browser }) => {
      test.setTimeout(180_000)
      const context = await browser.newContext({
        ...contextOptions,
        storageState: session,
        viewport: { width, height: 900 },
      })
      const page = await context.newPage()
      const guard = guardPage(page)
      for (const view of signedInViews) {
        await openView(page, view.path, view.title)
        await expect(page.getByTestId('skeleton-zone')).toHaveCount(0)
      }

      await page.addInitScript({ content: recordLayoutShift })
      await page.route('**/api/v1/**', async (route) => {
        await new Promise((resolve) => setTimeout(resolve, responseDelayMs))
        await route.continue()
      })

      for (const view of signedInViews) {
        await page.goto(view.path)
        await expect(
          page.locator('h1').filter({ hasText: view.title }),
        ).toBeVisible()
        if (view.path === '/') {
          await expect(page.getByTestId('skeleton-zone').first()).toBeVisible()
        }
        await page.waitForLoadState('networkidle')
        await expect(page.getByTestId('skeleton-zone')).toHaveCount(0, {
          timeout: 15_000,
        })
        await page.waitForLoadState('networkidle')

        const layoutShift: unknown = await page.evaluate(() =>
          Reflect.get(globalThis, 'mintLayoutShift'),
        )
        expect(typeof layoutShift, view.path).toBe('number')
        expect
          .soft(Number(layoutShift), view.path)
          .toBeLessThan(maximumLayoutShift)
      }
      guard.assertClean()
      await context.close()
    })
  }
})
