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

  await page.goto('/accounts')
  await page.getByTestId('accounts-add').click()
  const form = page.getByTestId('account-form')
  await expect(form).toBeVisible()
  await page
    .getByTestId('account-name-input')
    .fill(`Compte masqué ${Date.now()}`)
  await page.getByTestId('account-initial-balance').fill('500')
  await page.getByTestId('account-submit').click()
  await expect(form).toBeHidden()

  const total = page.getByTestId('accounts-total')
  const toggle = page.getByTestId('amount-mask-toggle')
  await expect(total).toContainText('€')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')

  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await expect(total).toContainText('****')
  await expect(total).not.toContainText('€')

  await page.reload()
  await expect(total).toContainText('****')
  await expect(toggle).toHaveAttribute('aria-pressed', 'true')

  for (const view of signedInViews) {
    await page.goto(view.path)
    await expect(
      page.locator('h1').filter({ hasText: view.title }),
    ).toBeVisible()
    await expect(toggle).toBeVisible()
  }

  await page.goto('/accounts')
  const otherTab = await page.context().newPage()
  await otherTab.goto('/accounts')
  await expect(otherTab.getByTestId('accounts-total')).toContainText('****')
  await otherTab.getByTestId('amount-mask-toggle').click()
  await expect(total).toContainText('€')
  await otherTab.getByTestId('amount-mask-toggle').click()
  await expect(total).toContainText('****')
  await otherTab.close()

  await page.getByTestId('sidebar-profile').click()
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL('/login')

  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')
  await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  await page.goto('/accounts')
  await expect(total).toContainText('€')
  guard.assertClean()
})
