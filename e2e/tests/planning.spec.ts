import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
} from '../support.ts'

function euros(cents: number, signDisplay: 'auto' | 'exceptZero' = 'auto') {
  return new Intl.NumberFormat('fr', {
    style: 'currency',
    currency: 'EUR',
    signDisplay,
  }).format(cents / 100)
}

async function choose(page: Page, testId: string, option: string) {
  await page.getByTestId(testId).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function createAccount(page: Page, name: string): Promise<void> {
  await page.goto('/accounts')
  await page.getByTestId('accounts-add').click()
  const form = page.getByTestId('account-form')
  await expect(form).toBeVisible()
  await page.getByTestId('account-name-input').fill(name)
  await page.getByTestId('account-initial-balance').fill('2000')
  await page.getByTestId('account-submit').click()
  await expect(form).toBeHidden()
}

async function recordExpense(
  page: Page,
  account: string,
  amount: string,
  label: string,
  category?: string,
): Promise<void> {
  await page.getByTestId('sidebar-quick-add').click()
  await page.getByRole('menuitem', { name: 'Dépense' }).click()
  const form = page.getByTestId('operation-form')
  await expect(form).toBeVisible()
  await choose(page, 'operation-source', account)
  await page.getByTestId('operation-amount').fill(amount)
  await page.getByTestId('operation-label').fill(label)
  if (category !== undefined) {
    await choose(page, 'operation-category', category)
  }
  await page.getByTestId('operation-submit').click()
  await expect(form).toBeHidden()
}

test.beforeEach(async ({ page }) => {
  await login(page, administratorEmail, administratorPassword)
  await expect(page).toHaveURL('/')
})

test('ECH-01, ECH-10: create a monthly schedule and see its next occurrence', async ({
  page,
}) => {
  const guard = guardPage(page)
  const account = `Courant échéances ${Date.now()}`
  await createAccount(page, account)

  await page.goto('/schedules')
  await page.getByTestId('schedules-add').click()
  const form = page.getByTestId('schedule-form')
  await expect(form).toBeVisible()
  await page.getByTestId('schedule-label').fill('Loyer e2e')
  await page.getByTestId('schedule-amount').fill('600')
  await choose(page, 'schedule-source', account)
  await choose(page, 'schedule-category', 'Logement')
  await page.getByTestId('schedule-submit').click()
  await expect(form).toBeHidden()

  const row = page.getByRole('row', { name: /Loyer e2e/ })
  await expect(row).toContainText('Tous les mois')
  await expect(row).toContainText(euros(-60_000, 'exceptZero'))
  await expect(row).toContainText(euros(60_000))
  await expect(page.getByTestId('total-expenses')).not.toHaveText(euros(0))

  await row.click()
  await expect(page.getByTestId('schedule-occurrences')).toBeVisible()
  guard.assertClean()
})

test('OPE-01, CPT-04: record an expense from the quick add and see the account balance move', async ({
  page,
}) => {
  const guard = guardPage(page)
  const account = `Courant opérations ${Date.now()}`
  await createAccount(page, account)

  await recordExpense(page, account, '45,50', 'Boulangerie e2e')

  await page.goto('/operations')
  await expect(page.getByTestId('operations-table')).toContainText(
    'Boulangerie e2e',
  )
  await expect(page.getByTestId('operations-table')).toContainText(
    euros(-4_550, 'exceptZero'),
  )
  await page.goto('/accounts')
  await expect(page.getByTestId('usage-group-current')).toContainText(account)
  await expect(page.getByTestId('usage-group-current')).toContainText(
    euros(195_450),
  )
  guard.assertClean()
})

test('ENV-01, ENV-06, ENV-08: create an envelope and see its consumption and the totals of the month', async ({
  page,
}) => {
  const guard = guardPage(page)
  const account = `Courant enveloppes ${Date.now()}`
  await createAccount(page, account)

  await page.goto('/envelopes')
  await page.getByTestId('envelopes-add').click()
  const form = page.getByTestId('envelope-form')
  await expect(form).toBeVisible()
  await page.getByTestId('envelope-label').fill('Courses e2e')
  await page.getByTestId('envelope-amount').fill('300')
  await choose(page, 'envelope-source', account)
  await page.getByTestId('envelope-categories').click()
  await page.getByRole('option', { name: 'Courses', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.getByTestId('envelope-submit').click()
  await expect(form).toBeHidden()

  await recordExpense(page, account, '120', 'Supermarché e2e', 'Courses')

  const row = page
    .getByTestId('envelopes-list')
    .getByRole('row')
    .filter({ hasText: 'Courses e2e' })
  await expect(row.getByTestId('envelope-consumed')).toHaveText(
    `${euros(12_000)} sur ${euros(30_000)}`,
  )
  await expect(row.getByTestId('envelope-available')).toHaveText(euros(18_000))
  await expect(page.getByTestId('envelopes-total-available')).toHaveText(
    euros(18_000),
  )
  guard.assertClean()
})

test('CAL-01 to CAL-03, DSH-01: read the day in the calendar and the balance curve', async ({
  page,
}) => {
  const guard = guardPage(page)
  const account = `Courant calendrier ${Date.now()}`
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
  }).format(new Date())
  await createAccount(page, account)
  await recordExpense(page, account, '50', 'Marché e2e')

  await page.goto('/calendar')
  await choose(page, 'forecast-account', account)
  const cell = page.getByTestId(`calendar-day-${today}`)
  await expect(cell).toContainText('1 opération')
  await expect(cell.getByTestId('calendar-balance')).toHaveText(euros(195_000))
  await expect(page.getByTestId('calendar-day-detail')).toContainText(
    'Marché e2e',
  )

  await page.goto('/')
  await choose(page, 'forecast-account', account)
  await expect(
    page.getByTestId('balance-curve-chart').locator('svg'),
  ).toBeVisible()
  await page.getByTestId('balance-curve-show-data').click()
  await expect(page.getByTestId('balance-curve-table')).toContainText(
    euros(195_000),
  )
  guard.assertClean()
})

test('IMP-01 to IMP-07, RAP-04: import a CSV line and confirm its reconciliation proposal', async ({
  page,
}) => {
  const guard = guardPage(page)
  const account = `Courant import ${Date.now()}`
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
  }).format(new Date())
  const inThreeDays = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Paris',
  }).format(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000))
  const [year, month, day] = today.split('-')
  await createAccount(page, account)

  await page.goto('/schedules')
  await page.getByTestId('schedules-add').click()
  const form = page.getByTestId('schedule-form')
  await expect(form).toBeVisible()
  await page.getByTestId('schedule-label').fill('Loyer import e2e')
  await page.getByTestId('schedule-amount').fill('600')
  await choose(page, 'schedule-source', account)
  await choose(page, 'schedule-category', 'Logement')
  await page.getByTestId('schedule-start-date').fill(inThreeDays)
  await page.getByTestId('schedule-submit').click()
  await expect(form).toBeHidden()

  await page.goto('/import')
  await choose(page, 'import-account', account)
  await page.getByTestId('import-file').setInputFiles({
    name: 'releve.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      `Date;Libellé;Montant\n${day}/${month}/${year};PRLV LOYER;-600,00\n`,
    ),
  })
  await page.getByTestId('import-upload').click()
  await choose(page, 'import-amount-mode', 'Une colonne signée')
  await page.getByTestId('import-preview').click()
  await expect(page.getByTestId('import-review')).toContainText('PRLV LOYER')
  await expect(page.getByTestId('import-reconcile-1')).toContainText(
    'Loyer import e2e',
  )
  await page.getByTestId('import-validate').click()
  await expect(page.getByTestId('import-history')).toContainText('Validé')

  await page.goto('/operations')
  await expect(page.getByTestId('operations-table')).toContainText(
    'Loyer import e2e',
  )
  await expect(
    page.getByTestId('operations-table').getByTestId('badge-reconciled'),
  ).toBeVisible()
  guard.assertClean()
})
