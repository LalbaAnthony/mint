import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { createBlankDatabase } from '../tests/database.js'
import type { IsolatedDatabase } from '../types/tests.js'
import { createSequelize, isDatabaseReachable } from './sequelize.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('isDatabaseReachable', () => {
  let database: IsolatedDatabase

  beforeAll(async () => {
    database = await createBlankDatabase()
  })

  afterAll(async () => {
    await database.drop()
  })

  it('is true when PostgreSQL answers', async () => {
    expect(await isDatabaseReachable(database.sequelize)).toBe(true)
  })

  it('is false and logs the failure when PostgreSQL is unreachable', async () => {
    const lines: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk))
      return true
    })
    const unreachable = createSequelize({
      DATABASE_HOST: '127.0.0.1',
      DATABASE_PORT: 1,
      DATABASE_NAME: 'mint',
      DATABASE_USER: 'mint',
      DATABASE_PASSWORD: 'unused',
    })

    try {
      expect(await isDatabaseReachable(unreachable)).toBe(false)
    } finally {
      await unreachable.close()
    }
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'database_unreachable',
      }),
    ])
  })
})
