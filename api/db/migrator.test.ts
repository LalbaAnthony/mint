import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { migrations } from '../migrations/index.js'
import { createBlankDatabase } from '../tests/database.js'
import type { IsolatedDatabase } from '../types/tests.js'
import { createMigrator, logMigrationEvent } from './migrator.js'

const migrationsDirectory = fileURLToPath(
  new URL('../migrations/', import.meta.url),
)

afterEach(() => {
  vi.restoreAllMocks()
})

describe('migration registry', () => {
  it('registers every migration file once, in file name order', () => {
    const migrationFileNames = readdirSync(migrationsDirectory)
      .filter((fileName) => /^\d{4}-.+\.ts$/.test(fileName))
      .filter((fileName) => !fileName.endsWith('.test.ts'))
      .map((fileName) => fileName.replace(/\.ts$/, ''))
      .sort()

    expect(migrations.map((migration) => migration.name)).toEqual(
      migrationFileNames,
    )
  })
})

describe('logMigrationEvent', () => {
  function captureStdout(): string[] {
    const lines: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk))
      return true
    })
    return lines
  }

  it('prefixes the Umzug event and keeps the other fields', () => {
    const lines = captureStdout()

    logMigrationEvent('info', { event: 'migrated', name: '0001-x' })

    expect(JSON.parse(lines[0] ?? '')).toEqual(
      expect.objectContaining({
        level: 'info',
        event: 'migration_migrated',
        name: '0001-x',
      }),
    )
  })

  it('falls back to a generic event without an Umzug event', () => {
    const lines = captureStdout()

    logMigrationEvent('info', { message: 'applied 1 migrations.' })

    expect(JSON.parse(lines[0] ?? '')).toEqual(
      expect.objectContaining({
        event: 'migration',
        message: 'applied 1 migrations.',
      }),
    )
  })
})

describe('createMigrator', () => {
  let database: IsolatedDatabase

  beforeAll(async () => {
    database = await createBlankDatabase()
  })

  afterAll(async () => {
    await database.drop()
  })

  async function isCitextInstalled(): Promise<boolean> {
    const [rows] = await database.sequelize.query(
      "SELECT 1 FROM pg_extension WHERE extname = 'citext'",
    )
    return rows.length === 1
  }

  async function listTables(): Promise<string[]> {
    const [rows] = await database.sequelize.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename",
    )
    return rows.flatMap((row) =>
      typeof row === 'object' &&
      row !== null &&
      'tablename' in row &&
      typeof row.tablename === 'string'
        ? [row.tablename]
        : [],
    )
  }

  it('applies then reverts every migration', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const migrator = createMigrator(database.sequelize)

    await migrator.up()

    expect((await migrator.executed()).map(({ name }) => name)).toEqual(
      migrations.map(({ name }) => name),
    )
    expect(await isCitextInstalled()).toBe(true)
    expect(await listTables()).toEqual([
      'categories',
      'email_change_tokens',
      'invitations',
      'password_reset_tokens',
      'sessions',
      'users',
    ])

    await migrator.down({ to: 0 })

    expect(await migrator.executed()).toEqual([])
    expect(await isCitextInstalled()).toBe(false)
    expect(await listTables()).toEqual([])
  })
})
