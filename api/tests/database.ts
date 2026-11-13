import { randomUUID } from 'node:crypto'
import { inject } from 'vitest'
import { createSequelize } from '../db/sequelize.js'
import type { IsolatedDatabase } from '../types/tests.js'
import {
  cloneTemplate,
  createEmptyDatabase,
  dropDatabase,
} from './database-server.js'

function uniqueName(prefix: string, kind: string): string {
  return `${prefix}_${kind}_${randomUUID().replaceAll('-', '').slice(0, 12)}`
}

async function openDatabase(
  create: (name: string) => Promise<void>,
  kind: string,
): Promise<IsolatedDatabase> {
  const server = inject('testDatabaseServer')
  const name = uniqueName(server.prefix, kind)
  await create(name)
  const sequelize = createSequelize({
    DATABASE_HOST: server.DATABASE_HOST,
    DATABASE_PORT: server.DATABASE_PORT,
    DATABASE_USER: server.DATABASE_USER,
    DATABASE_PASSWORD: server.DATABASE_PASSWORD,
    DATABASE_NAME: name,
  })
  return {
    sequelize,
    drop: async () => {
      await sequelize.close()
      await dropDatabase(server, name)
    },
  }
}

export function createMigratedDatabase(): Promise<IsolatedDatabase> {
  const server = inject('testDatabaseServer')
  return openDatabase((name) => cloneTemplate(server, name), 'migrated')
}

export function createBlankDatabase(): Promise<IsolatedDatabase> {
  const server = inject('testDatabaseServer')
  return openDatabase((name) => createEmptyDatabase(server, name), 'blank')
}
