import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
  openView,
  signedInViews,
} from '../support.ts'

async function horizontalOverflow(page: Page): Promise<number> {
  return page
    .locator('html, [data-slot=body]')
    .evaluateAll((scrollers: unknown[]) =>
      Math.max(
        ...scrollers.map((scroller) => {
          if (typeof scroller !== 'object' || scroller === null) {
            throw new Error('The scroller is not an element')
          }
          const scrollWidth: unknown = Reflect.get(scroller, 'scrollWidth')
          const clientWidth: unknown = Reflect.get(scroller, 'clientWidth')
          if (
            typeof scrollWidth !== 'number' ||
            typeof clientWidth !== 'number'
          ) {
            throw new Error('The scroller has no scroll width')
          }
          return scrollWidth - clientWidth
        }),
      ),
    )
}

test.describe('NF-UX-01, NF-ACC-01: reflow at 320 px', () => {
  test.use({ viewport: { width: 320, height: 800 } })

  test('no signed-in view scrolls horizontally', async ({ page }) => {
    const guard = guardPage(page)
    await login(page, administratorEmail, administratorPassword)
    await expect(page).toHaveURL('/')
    for (const view of signedInViews) {
      await openView(page, view.path, view.title)
      expect.soft(await horizontalOverflow(page), view.path).toBe(0)
    }
    guard.assertClean()
  })

  test('the forms with a kind choice do not scroll horizontally', async ({
    page,
  }) => {
    const guard = guardPage(page)
    await login(page, administratorEmail, administratorPassword)
    await expect(page).toHaveURL('/')

    await page.getByTestId('fab').click()
    await page.getByTestId('fab-expense').click()
    await expect(page.getByTestId('operation-kind')).toBeVisible()
    expect.soft(await horizontalOverflow(page), 'operation form').toBe(0)

    await openView(page, '/schedules', 'Échéances')
    await page.getByTestId('schedules-add').click()
    await expect(page.getByTestId('schedule-kind')).toBeVisible()
    expect.soft(await horizontalOverflow(page), 'schedule form').toBe(0)

    await openView(page, '/rules', 'Règles')
    await page.getByTestId('rules-add').click()
    await expect(page.getByRole('dialog').getByRole('radiogroup')).toBeVisible()
    expect.soft(await horizontalOverflow(page), 'rule form').toBe(0)
    guard.assertClean()
  })
})
