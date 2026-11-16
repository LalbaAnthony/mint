import AxeBuilder from '@axe-core/playwright'
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

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

const blockingImpacts = ['serious', 'critical']

const publicViews = [
  { path: '/login', title: 'Connexion' },
  { path: '/forgot-password', title: 'Mot de passe oublié' },
]

async function blockingViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(wcagTags).analyze()
  return results.violations
    .filter(
      (violation) =>
        typeof violation.impact === 'string' &&
        blockingImpacts.includes(violation.impact),
    )
    .map((violation) => ({
      rule: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) =>
        [node.target.join(' '), node.failureSummary?.split('\n')[1]?.trim()]
          .filter((part) => part !== undefined && part !== '')
          .join(': '),
      ),
    }))
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`NF-ACC-01, CA-02: ${colorScheme} theme`, () => {
    test.use({ colorScheme })

    test('public pages have no serious or critical violation', async ({
      page,
    }) => {
      const guard = guardPage(page)
      for (const view of publicViews) {
        await openView(page, view.path, view.title)
        expect.soft(await blockingViolations(page), view.path).toEqual([])
      }
      guard.assertClean()
    })

    test('the views of a signed-in user have no serious or critical violation', async ({
      page,
    }) => {
      const guard = guardPage(page)
      await login(page, administratorEmail, administratorPassword)
      await expect(page).toHaveURL('/')
      await expect(page.locator('html')).toHaveClass(
        colorScheme === 'dark' ? /\bdark\b/ : /^(?!.*\bdark\b)/,
      )
      for (const view of signedInViews) {
        await openView(page, view.path, view.title)
        expect.soft(await blockingViolations(page), view.path).toEqual([])
      }
      guard.assertClean()
    })

    test('the quick add form and the mobile drawer have no serious or critical violation', async ({
      page,
    }) => {
      const guard = guardPage(page)
      await login(page, administratorEmail, administratorPassword)
      await expect(page).toHaveURL('/')

      await page.getByTestId('sidebar-quick-add').click()
      await page.getByRole('menuitem', { name: 'Dépense' }).click()
      await expect(page.getByTestId('operation-form')).toBeVisible()
      expect.soft(await blockingViolations(page), 'operation form').toEqual([])
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('operation-form')).toBeHidden()

      await page.setViewportSize({ width: 390, height: 844 })
      await openView(page, '/accounts', 'Comptes')
      await page.getByTestId('bottom-bar-more').click()
      await expect(page.getByRole('dialog')).toBeVisible()
      expect.soft(await blockingViolations(page), 'more drawer').toEqual([])
      guard.assertClean()
    })
  })
}
