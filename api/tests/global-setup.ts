import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'
import { createMigrator } from '../db/migrator.js'
import { createSequelize } from '../db/sequelize.js'
import { parseEnvironment } from '../environment.js'
import { testDatabaseEnvironmentSchema } from '../schemas/environment.js'
import { dropDatabasesWithPrefix, runOnServer } from './database-server.js'

const rootEnvironmentFile = fileURLToPath(
  new URL('../../.env', import.meta.url),
)

export default async function setUpTestDatabase(project: TestProject) {
  if (existsSync(rootEnvironmentFile)) {
    process.loadEnvFile(rootEnvironmentFile)
  }
  const environment = parseEnvironment(
    testDatabaseEnvironmentSchema,
    process.env,
  )
  const server = {
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: environment.DB_HOST_PORT,
    DATABASE_USER: environment.POSTGRES_USER,
    DATABASE_PASSWORD: environment.POSTGRES_PASSWORD,
  }
  const prefix = `mint_test_${process.pid}_${Date.now()}`
  const testServer = {
    ...server,
    maintenanceDatabase: environment.POSTGRES_DB,
    templateDatabase: `${prefix}_template`,
    prefix,
  }

  try {
    await runOnServer(testServer, (client) =>
      client.query(`CREATE DATABASE "${testServer.templateDatabase}"`),
    )
  } catch (error) {
    throw new Error(
      `API tests need PostgreSQL on 127.0.0.1:${environment.DB_HOST_PORT}, start it with: docker compose --profile dev up -d db-dev`,
      { cause: error },
    )
  }

  const template = createSequelize({
    ...server,
    DATABASE_NAME: testServer.templateDatabase,
  })
  try {
    await createMigrator(template).up()
  } finally {
    await template.close()
  }

  project.provide('testDatabaseServer', testServer)

  return () => dropDatabasesWithPrefix(testServer)
}
