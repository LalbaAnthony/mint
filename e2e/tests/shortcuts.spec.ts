import { expect, test } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
} from '../support.ts'

test('RAC-02 to RAC-07: search, add, submit and get help from the keyboard', async ({
  page,
}) => {
  const guard = guardPage(page)
  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')

  await expect(page.getByTestId('sidebar-search-kbds')).toHaveText(/Ctrl\s*K/)
  await expect(page.getByTestId('sidebar-search-field')).toHaveAttribute(
    'aria-keyshortcuts',
    'Control+K',
  )

  await page.keyboard.press('Control+k')
  const palette = page.getByTestId('search-palette')
  await expect(palette).toBeVisible()
  await page.keyboard.press('Control+Alt+n')
  await expect(page.getByRole('menu')).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(palette).toBeHidden()

  await page.keyboard.press('Control+Alt+n')
  const menu = page.getByRole('menu')
  await expect(menu).toBeVisible()
  await page.keyboard.press('d')
  await expect(page.getByRole('menuitem', { name: 'Dépense' })).toBeFocused()
  await page.keyboard.press('Enter')
  const operationForm = page.getByTestId('operation-form')
  await expect(operationForm).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(operationForm).toBeHidden()

  await page.goto('/accounts')
  await expect(page.getByTestId('accounts-add')).toHaveAttribute(
    'aria-keyshortcuts',
    'Control+Alt+N',
  )
  await page.keyboard.press('Control+Alt+n')
  const accountForm = page.getByTestId('account-form')
  await expect(accountForm).toBeVisible()
  await expect(page.getByRole('menu')).toBeHidden()
  await page.getByTestId('account-name-input').fill('Coffre Clavier')
  await page.getByTestId('account-initial-balance').fill('80')
  await page.keyboard.press('Control+Enter')
  await expect(accountForm).toBeHidden()
  await expect(page.getByText('Coffre Clavier').first()).toBeVisible()

  await page.keyboard.press('Control+/')
  const help = page.getByTestId('shortcut-help')
  await expect(help).toBeVisible()
  await expect(help.getByRole('heading')).toHaveText([
    'Général',
    'Vues',
    'Formulaires',
  ])
  await page.keyboard.press('Escape')
  await expect(help).toBeHidden()

  await page.getByTestId('sidebar-profile').click()
  await page.getByRole('menuitem', { name: /Raccourcis clavier/ }).click()
  await expect(help).toBeVisible()

  guard.assertClean()
})
