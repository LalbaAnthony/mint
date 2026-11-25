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

  test('the breakdown month navigation stays on one row', async ({ page }) => {
    const guard = guardPage(page)
    await login(page, administratorEmail, administratorPassword)
    await expect(page).toHaveURL('/')

    const navigation = page.getByTestId('breakdown-month-navigation')
    await expect(navigation).toBeVisible()
    const controls = await navigation.locator(':scope > *').all()
    expect(controls).toHaveLength(3)
    const middles = await Promise.all(
      controls.map(async (control) => {
        const box = await control.boundingBox()
        if (box === null) {
          throw new Error('The month navigation control is not rendered')
        }
        return box.y + box.height / 2
      }),
    )
    expect(Math.max(...middles) - Math.min(...middles)).toBeLessThan(1)
    guard.assertClean()
  })

  test('the forms with a kind choice do not scroll horizontally', async ({
    page,
  }) => {
    const guard = guardPage(page)
    await login(page, administratorEmail, administratorPassword)
    await expect(page).toHaveURL('/')

    await page.getByTestId('add-fab').click()
    await page.getByTestId('add-fab-expense').click()
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
