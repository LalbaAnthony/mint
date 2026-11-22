import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export const administratorEmail = 'admin@mint.localhost'
export const administratorPassword = 'e2e administrator password'

export const httpOrigin = `http://localhost:${process.env.E2E_HTTP_PORT ?? '8090'}`
export const mailpitOrigin = `http://localhost:${process.env.E2E_MAILPIT_PORT ?? '8126'}`

export const signedInViews = [
  { path: '/', title: 'Accueil' },
  { path: '/accounts', title: 'Comptes' },
  { path: '/calendar', title: 'Calendrier' },
  { path: '/operations', title: 'Opérations' },
  { path: '/schedules', title: 'Échéances' },
  { path: '/subscriptions', title: 'Abonnements' },
  { path: '/envelopes', title: 'Enveloppes' },
  { path: '/import', title: 'Import' },
  { path: '/rules', title: 'Règles' },
  { path: '/search?q=co', title: 'Recherche' },
  { path: '/profile', title: 'Profil et préférences' },
  { path: '/admin', title: 'Administration' },
]

export async function openView(
  page: Page,
  path: string,
  title: string,
): Promise<void> {
  await page.goto(path)
  await expect(page.locator('h1').filter({ hasText: title })).toBeVisible()
  await page.waitForLoadState('networkidle')
}

export function uniqueEmail(prefix: string): string {
  return `${prefix}-${Date.now()}@mint.localhost`
}

export function guardPage(page: Page) {
  const violations: string[] = []
  const foreignRequests: string[] = []
  page.on('console', (message) => {
    if (/Content[- ]Security[- ]Policy/i.test(message.text())) {
      violations.push(message.text())
    }
  })
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.protocol.startsWith('http') && url.origin !== httpOrigin) {
      foreignRequests.push(request.url())
    }
  })
  return {
    assertClean: () => {
      expect(violations).toEqual([])
      expect(foreignRequests).toEqual([])
    },
  }
}

export async function login(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login')
  await page.getByLabel('Adresse email', { exact: true }).fill(email)
  await page.getByLabel('Mot de passe', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click()
}

function readString(source: unknown, key: string): string | undefined {
  if (typeof source !== 'object' || source === null) {
    return undefined
  }
  const value: unknown = Reflect.get(source, key)
  return typeof value === 'string' ? value : undefined
}

function readArray(source: unknown, key: string): unknown[] {
  if (typeof source !== 'object' || source === null) {
    return []
  }
  const value: unknown = Reflect.get(source, key)
  return Array.isArray(value) ? value : []
}

async function findMessageId(email: string): Promise<string | undefined> {
  const response = await fetch(`${mailpitOrigin}/api/v1/messages`)
  const messages = readArray(await response.json(), 'messages')
  const message = messages.find((candidate) =>
    readArray(candidate, 'To').some(
      (recipient) => readString(recipient, 'Address') === email,
    ),
  )
  return readString(message, 'ID')
}

export async function readLinkSentTo(email: string): Promise<string> {
  let messageId: string | undefined
  await expect
    .poll(async () => {
      messageId = await findMessageId(email)
      return messageId
    })
    .toBeDefined()
  const response = await fetch(`${mailpitOrigin}/api/v1/message/${messageId}`)
  const text = readString(await response.json(), 'Text') ?? ''
  const link = text.match(/https?:\/\/\S+#token=[A-Za-z0-9_-]+/)?.[0]
  if (link === undefined) {
    throw new Error(`No link in the email sent to ${email}`)
  }
  return link
}
