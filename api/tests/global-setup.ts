import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { TestProject } from 'vitest/node'
import { createSequelize } from '../db/sequelize.js'
import { parseEnvironment } from '../environment.js'
import { testDatabaseEnvironmentSchema } from '../schemas/environment.js'

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
  const serverConnection = {
    DATABASE_HOST: '127.0.0.1',
    DATABASE_PORT: environment.DB_HOST_PORT,
    DATABASE_USER: environment.POSTGRES_USER,
    DATABASE_PASSWORD: environment.POSTGRES_PASSWORD,
  }
  const maintenance = createSequelize({
    ...serverConnection,
    DATABASE_NAME: environment.POSTGRES_DB,
  })
  try {
    await maintenance.authenticate()
  } catch (error) {
    await maintenance.close()
    throw new Error(
      `API tests need PostgreSQL on 127.0.0.1:${environment.DB_HOST_PORT}, start it with: docker compose --profile dev up -d db-dev`,
      { cause: error },
    )
  }

  const testDatabaseName = `mint_test_${process.pid}_${Date.now()}`
  await maintenance.query(`CREATE DATABASE "${testDatabaseName}"`)
  project.provide('testDatabase', {
    ...serverConnection,
    DATABASE_NAME: testDatabaseName,
  })

  return async () => {
    try {
      await maintenance.query(
        `DROP DATABASE IF EXISTS "${testDatabaseName}" WITH (FORCE)`,
      )
    } finally {
      await maintenance.close()
    }
  }
}
