import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
} from '../support.ts'

function euros(cents: number): string {
  return new Intl.NumberFormat('fr', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100)
}

async function choose(page: Page, testId: string, option: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function createAccount(
  page: Page,
  account: {
    name: string
    nature?: string
    product?: string
    usage?: string
    balance: string
  },
): Promise<void> {
  await page.getByTestId('accounts-add').click()
  const form = page.getByTestId('account-form')
  await expect(form).toBeVisible()
  await page.getByTestId('account-name-input').fill(account.name)
  if (account.nature !== undefined) {
    await choose(page, 'account-nature', account.nature)
  }
  if (account.product !== undefined) {
    await choose(page, 'account-product', account.product)
  }
  if (account.usage !== undefined) {
    await choose(page, 'account-usage', account.usage)
  }
  await page.getByTestId('account-initial-balance').fill(account.balance)
  await page.getByTestId('account-submit').click()
  await expect(form).toBeHidden()
}

test('US-04, PAY-01: create accounts, see where my money is, attach a payment method', async ({
  page,
}) => {
  const guard = guardPage(page)
  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')

  await page.goto('/accounts')
  await expect(page.getByText('Aucun compte')).toBeVisible()

  await createAccount(page, { name: 'Compte courant', balance: '2000' })
  await createAccount(page, {
    name: 'LEP',
    nature: 'Livret réglementé',
    product: 'LEP',
    usage: 'Épargne de précaution',
    balance: '5 000',
  })
  await createAccount(page, {
    name: 'Livret A',
    nature: 'Livret réglementé',
    product: 'Livret A',
    usage: 'Épargne',
    balance: '12000,00',
  })

  const subtotal = (usage: string) =>
    page.getByTestId(`usage-group-${usage}`).getByTestId('usage-subtotal')
  await expect(subtotal('current')).toHaveText(euros(200_000))
  await expect(subtotal('emergency')).toHaveText(euros(500_000))
  await expect(subtotal('savings')).toHaveText(euros(1_200_000))
  await expect(page.getByTestId('accounts-total')).toContainText(
    euros(1_900_000),
  )
  await expect(subtotal('current')).toHaveCSS(
    'font-variant-numeric',
    'tabular-nums',
  )

  const currentGroup = page.getByTestId('usage-group-current')
  await currentGroup.getByTestId('account-toggle').click()
  await currentGroup.getByTestId('add-payment-method').click()
  const form = page.getByTestId('payment-method-form')
  await expect(form).toBeVisible()
  await page.getByTestId('payment-method-label').fill('Carte CA')
  await page.getByTestId('payment-method-submit').click()
  await expect(form).toBeHidden()
  await expect(currentGroup).toContainText('Carte CA')
  await expect(currentGroup).toContainText('Carte bancaire')
  await expect(currentGroup).toContainText('1 moyen de paiement')

  guard.assertClean()
})
