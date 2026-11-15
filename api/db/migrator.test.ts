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
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> 'schema_migrations' ORDER BY tablename COLLATE \"C\"",
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
      'account_statements',
      'accounts',
      'categories',
      'categorization_rules',
      'email_change_tokens',
      'envelope_categories',
      'envelopes',
      'import_batches',
      'import_mappings',
      'import_rows',
      'invitations',
      'password_reset_tokens',
      'payment_methods',
      'schedule_occurrences',
      'schedule_tags',
      'schedules',
      'sessions',
      'tags',
      'transaction_tags',
      'transactions',
      'users',
      'valuations',
    ])

    await migrator.down({ to: 0 })

    expect(await migrator.executed()).toEqual([])
    expect(await isCitextInstalled()).toBe(false)
    expect(await listTables()).toEqual([])
  })
})

describe('0008-add-system-categories', () => {
  let database: IsolatedDatabase

  beforeAll(async () => {
    database = await createBlankDatabase()
  })

  afterAll(async () => {
    await database.drop()
  })

  it('gives every existing user the system categories in its locale (CAT-08)', async () => {
    vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const migrator = createMigrator(database.sequelize)
    await migrator.up({ to: '0007-create-categories' })
    await database.sequelize.query(
      `INSERT INTO users (email, password_hash, role, locale)
       VALUES ('en@example.org', 'hash', 'user', 'en'),
              ('fr@example.org', 'hash', 'user', 'fr')`,
    )

    await migrator.up()

    const [rows] = await database.sequelize.query(
      `SELECT users.email, kind, name, is_system, parent_id, expense_group
       FROM categories JOIN users ON users.id = categories.user_id
       ORDER BY users.email, categories.sort_order`,
    )
    expect(rows).toEqual([
      {
        email: 'en@example.org',
        kind: 'income',
        name: 'Interest',
        is_system: true,
        parent_id: null,
        expense_group: null,
      },
      {
        email: 'en@example.org',
        kind: 'adjustment',
        name: 'Adjustment',
        is_system: true,
        parent_id: null,
        expense_group: null,
      },
      {
        email: 'fr@example.org',
        kind: 'income',
        name: 'Intérêts',
        is_system: true,
        parent_id: null,
        expense_group: null,
      },
      {
        email: 'fr@example.org',
        kind: 'adjustment',
        name: 'Ajustement',
        is_system: true,
        parent_id: null,
        expense_group: null,
      },
    ])
  })

  it('allows one system category per kind and no user-defined adjustment', async () => {
    const insert = (kind: string, name: string, isSystem: boolean) =>
      database.sequelize.query(
        `INSERT INTO categories (user_id, kind, name, is_system)
         SELECT id, $1, $2, $3 FROM users WHERE email = 'fr@example.org'`,
        { bind: [kind, name, isSystem] },
      )

    await expect(insert('adjustment', 'Correction', true)).rejects.toThrow()
    await expect(insert('adjustment', 'Correction', false)).rejects.toThrow()
    await expect(insert('expense', 'Système', true)).rejects.toThrow()
    await expect(insert('income', 'Dividendes', false)).resolves.toBeDefined()
  })
})
