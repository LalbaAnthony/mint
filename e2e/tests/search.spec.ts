import { expect, test } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
} from '../support.ts'

test('RCH-01 to RCH-06: search from the sidebar, see all results, open an account', async ({
  page,
}) => {
  const guard = guardPage(page)
  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')

  await page.goto('/accounts')
  await page.getByTestId('accounts-add').click()
  const form = page.getByTestId('account-form')
  await expect(form).toBeVisible()
  await page.getByTestId('account-name-input').fill('Coffre Zéphyr')
  await page.getByTestId('account-initial-balance').fill('150')
  await page.getByTestId('account-submit').click()
  await expect(form).toBeHidden()

  await page.getByTestId('sidebar-search-field').click()
  const palette = page.getByTestId('search-palette')
  await expect(palette).toBeVisible()
  await expect(palette).toContainText('Saisissez au moins 2 caractères.')
  await palette.locator('input').fill('zephyr')
  await expect(
    page.getByRole('option', { name: /Coffre Zéphyr/ }),
  ).toBeVisible()
  await expect(page.getByRole('option').first()).toContainText(
    'Voir tous les résultats pour « zephyr »',
  )
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL('/search?q=zephyr')
  await expect(palette).toBeHidden()
  const accounts = page.getByTestId('search-section-accounts')
  await expect(accounts.getByRole('heading')).toHaveText('Comptes (1)')
  await expect(page.getByTestId('search-input')).toHaveValue('zephyr')

  await accounts.getByRole('button', { name: /Coffre Zéphyr/ }).click()

  await expect(page).toHaveURL('/accounts')
  const row = page.locator('[data-linked-target]')
  await expect(row).toContainText('Coffre Zéphyr')
  await expect(row).toHaveClass(/ring-primary/)

  guard.assertClean()
})
