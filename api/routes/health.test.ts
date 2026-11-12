import request from 'supertest'
import { afterAll, describe, expect, it } from 'vitest'
import { createApp } from '../app.js'
import { isDatabaseReachable } from '../db/sequelize.js'
import { createTestSequelize } from '../tests/database.js'

describe('GET /api/v1/health', () => {
  it('answers 200 when the database is reachable', async () => {
    const app = createApp({ checkDatabase: async () => true })

    const response = await request(app).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body).toEqual({
      status: 'ok',
      checks: { api: 'ok', database: 'ok' },
    })
  })

  it('answers 503 when the database is unreachable', async () => {
    const app = createApp({ checkDatabase: async () => false })

    const response = await request(app).get('/api/v1/health')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      status: 'unavailable',
      checks: { api: 'ok', database: 'unavailable' },
    })
  })

  describe('with PostgreSQL', () => {
    const sequelize = createTestSequelize()

    afterAll(async () => {
      await sequelize.close()
    })

    it('answers 200 against the test database', async () => {
      const app = createApp({
        checkDatabase: () => isDatabaseReachable(sequelize),
      })

      const response = await request(app).get('/api/v1/health')

      expect(response.status).toBe(200)
      expect(response.body.checks.database).toBe('ok')
    })
  })
})
