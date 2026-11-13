import { expect, test } from '@playwright/test'
import {
  administratorEmail,
  administratorPassword,
  guardPage,
  login,
  readLinkSentTo,
  uniqueEmail,
} from '../support.ts'

test('US-01: an invited relative creates an account from the emailed link', async ({
  browser,
}) => {
  const inviteeEmail = uniqueEmail('proche')

  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  const adminGuard = guardPage(adminPage)
  await login(adminPage, administratorEmail, administratorPassword)
  await expect(adminPage).toHaveURL('/')
  await adminPage.goto('/admin')
  await adminPage.getByTestId('admin-invite').click()
  await adminPage.getByTestId('invite-email').fill(inviteeEmail)
  await adminPage.getByTestId('invite-submit').click()
  await expect(adminPage.getByTestId('invitation-list')).toContainText(
    inviteeEmail,
  )
  adminGuard.assertClean()

  const link = await readLinkSentTo(inviteeEmail)

  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  const inviteeGuard = guardPage(inviteePage)
  await inviteePage.goto(link)
  await expect(inviteePage.getByTestId('invitation-form')).toContainText(
    inviteeEmail,
  )
  await inviteePage
    .getByLabel('Nouveau mot de passe', { exact: true })
    .fill('a brand new password')
  await inviteePage
    .getByLabel('Confirmation du mot de passe', { exact: true })
    .fill('a brand new password')
  await inviteePage.getByTestId('invitation-submit').click()
  await expect(inviteePage).toHaveURL('/')
  await expect(inviteePage.getByRole('heading', { level: 1 })).toHaveText(
    'Accueil',
  )

  await inviteePage.goto('/admin')
  await expect(inviteePage).toHaveURL('/')
  inviteeGuard.assertClean()

  const replayContext = await browser.newContext()
  const replayPage = await replayContext.newPage()
  await replayPage.goto(link)
  await expect(replayPage.getByTestId('invitation-error')).toContainText(
    "Ce lien d'invitation n'est plus valide.",
  )

  await Promise.all([
    adminContext.close(),
    inviteeContext.close(),
    replayContext.close(),
  ])
})
