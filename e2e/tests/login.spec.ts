import { expect, test } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
} from '../support.ts'

test('AUTH-02: wrong password refused, then login, logout and guarded views', async ({
  page,
}) => {
  const guard = guardPage(page)

  await page.goto('/accounts')
  await expect(page).toHaveURL('/login?redirect=/accounts')

  await login(page, administratorEmail, 'not the password')
  await expect(page.getByTestId('login-error')).toHaveText(
    'Adresse email ou mot de passe incorrect.',
  )

  await page
    .getByLabel('Mot de passe', { exact: true })
    .fill(administratorPassword)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
  await expect(page).toHaveURL('/')

  await page.getByTestId('sidebar-profile').click()
  await page.getByRole('menuitem', { name: 'Déconnexion' }).click()
  await expect(page).toHaveURL('/login')

  await page.goto('/')
  await expect(page).toHaveURL('/login')
  guard.assertClean()
})
