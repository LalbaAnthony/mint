import pg from 'pg'
import { z } from 'zod'
import type { TestDatabaseServer } from '../types/tests.js'

const templateLockKey = 7_021_946

const databaseNamesSchema = z.array(z.object({ datname: z.string() }))

export async function runOnServer<Result>(
  server: TestDatabaseServer,
  operation: (client: pg.Client) => Promise<Result>,
): Promise<Result> {
  const client = new pg.Client({
    host: server.DATABASE_HOST,
    port: server.DATABASE_PORT,
    user: server.DATABASE_USER,
    password: server.DATABASE_PASSWORD,
    database: server.maintenanceDatabase,
  })
  await client.connect()
  try {
    return await operation(client)
  } finally {
    await client.end()
  }
}

export function cloneTemplate(
  server: TestDatabaseServer,
  name: string,
): Promise<void> {
  return runOnServer(server, async (client) => {
    await client.query('SELECT pg_advisory_lock($1)', [templateLockKey])
    try {
      await client.query(
        `CREATE DATABASE "${name}" TEMPLATE "${server.templateDatabase}"`,
      )
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [templateLockKey])
    }
  })
}

export function createEmptyDatabase(
  server: TestDatabaseServer,
  name: string,
): Promise<void> {
  return runOnServer(server, async (client) => {
    await client.query(`CREATE DATABASE "${name}"`)
  })
}

export function dropDatabase(
  server: TestDatabaseServer,
  name: string,
): Promise<void> {
  return runOnServer(server, async (client) => {
    await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`)
  })
}

export function dropDatabasesWithPrefix(
  server: TestDatabaseServer,
): Promise<void> {
  return runOnServer(server, async (client) => {
    const result = await client.query(
      'SELECT datname FROM pg_database WHERE starts_with(datname, $1)',
      [server.prefix],
    )
    for (const { datname } of databaseNamesSchema.parse(result.rows)) {
      await client.query(`DROP DATABASE IF EXISTS "${datname}" WITH (FORCE)`)
    }
  })
}
