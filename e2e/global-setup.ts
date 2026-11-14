import { argon2id, hash } from 'argon2'
import pg from 'pg'
import {
  administratorEmail,
  administratorPassword,
  httpOrigin,
  mailpitOrigin,
} from './support.ts'

const healthTimeoutMs = 120_000

async function waitForHealth(): Promise<void> {
  const deadline = Date.now() + healthTimeoutMs
  let lastError = 'no answer'
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${httpOrigin}/api/v1/health`)
      if (response.ok) {
        return
      }
      lastError = `status ${response.status}`
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    }
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
  throw new Error(
    `The end-to-end stack does not answer on ${httpOrigin} (${lastError}). Start it with: docker compose -f e2e/compose.yml up --build --detach --wait`,
  )
}

async function seedAdministrator(): Promise<void> {
  const client = new pg.Client({
    host: '127.0.0.1',
    port: Number(process.env.E2E_DB_PORT ?? '5442'),
    user: 'mint',
    password: 'mint-e2e-only',
    database: 'mint',
  })
  await client.connect()
  try {
    await client.query(
      `INSERT INTO users (email, password_hash, role, locale)
       VALUES ($1, $2, 'admin', 'fr')
       ON CONFLICT (email) DO UPDATE
         SET password_hash = EXCLUDED.password_hash, status = 'active'`,
      [
        administratorEmail,
        await hash(administratorPassword, { type: argon2id }),
      ],
    )
    await client.query(
      `DELETE FROM payment_methods
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [administratorEmail],
    )
    await client.query(
      `DELETE FROM accounts
       WHERE user_id = (SELECT id FROM users WHERE email = $1)`,
      [administratorEmail],
    )
  } finally {
    await client.end()
  }
}

async function clearMailbox(): Promise<void> {
  const response = await fetch(`${mailpitOrigin}/api/v1/messages`, {
    method: 'DELETE',
  })
  if (!response.ok) {
    throw new Error(`Mailpit answered ${response.status} on ${mailpitOrigin}`)
  }
}

export default async function globalSetup(): Promise<void> {
  await waitForHealth()
  await seedAdministrator()
  await clearMailbox()
}
