import { expect, test } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
  signedInViews,
} from '../support.ts'

test('DSH-05: masked mode from the header, kept on the device, cleared at logout', async ({
  page,
}) => {
  const guard = guardPage(page)
  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')

  const wealth = page.getByTestId('dashboard-wealth')
  const toggle = page.getByTestId('amount-mask-toggle')
  await expect(wealth).toContainText('€')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(wealth).toContainText('****')
  await expect(wealth).not.toContainText('€')

  await page.reload()
  await expect(wealth).toContainText('****')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  for (const view of signedInViews) {
    await page.goto(view.path)
    await expect(
      page.locator('h1').filter({ hasText: view.title }),
    ).toBeVisible()
    await expect(toggle).toBeVisible()
  }

  await page.goto('/')
  const otherTab = await page.context().newPage()
  await otherTab.goto('/')
  await expect(otherTab.getByTestId('dashboard-wealth')).toContainText('****')
  await otherTab.getByTestId('amount-mask-toggle').click()
  await expect(wealth).toContainText('€')
  await otherTab.getByTestId('amount-mask-toggle').click()
  await expect(wealth).toContainText('****')
  await otherTab.close()

  await page.getByTestId('sidebar-profile').click()
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL('/login')

  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await expect(wealth).toContainText('€')
  guard.assertClean()
})
