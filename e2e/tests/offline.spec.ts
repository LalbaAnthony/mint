import { expect, test } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
} from '../support.ts'

const serviceWorkerState = `navigator.serviceWorker
  .getRegistration()
  .then((registration) => registration?.active?.state ?? 'none')`

const sessionCopied = `caches
  .open('mint-offline-data')
  .then((cache) => cache.match('/api/v1/auth/session'))
  .then((response) => response !== undefined)`

test('NF-PWA-02: the app opens offline from its service worker', async ({
  page,
  context,
}) => {
  const guard = guardPage(page)
  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')

  await expect.poll(() => page.evaluate(serviceWorkerState)).toBe('activated')
  await expect.poll(() => page.evaluate(sessionCopied)).toBe(true)

  await context.setOffline(true)
  await page.goto('/')
  await expect(page.locator('h1').filter({ hasText: 'Accueil' })).toBeVisible()
  await expect(page.getByTestId('offline-banner')).toBeVisible()
  guard.assertClean()
})
