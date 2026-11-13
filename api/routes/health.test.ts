import request from 'supertest'
import { afterEach, describe, expect, it } from 'vitest'
import { createTestContext } from '../tests/context.js'
import type { TestContext } from '../types/tests.js'

let context: TestContext | undefined

afterEach(async () => {
  await context?.close()
  context = undefined
})

describe('GET /api/v1/health', () => {
  it('answers 200 against the test database', async () => {
    context = await createTestContext()

    const response = await request(context.server).get('/api/v1/health')

    expect(response.status).toBe(200)
    expect(response.headers['cache-control']).toBe('no-store')
    expect(response.body).toEqual({
      status: 'ok',
      checks: { api: 'ok', database: 'ok' },
    })
  })

  it('answers 503 when the database is unreachable', async () => {
    context = await createTestContext({ checkDatabase: async () => false })

    const response = await request(context.server).get('/api/v1/health')

    expect(response.status).toBe(503)
    expect(response.body).toEqual({
      status: 'unavailable',
      checks: { api: 'ok', database: 'unavailable' },
    })
  })
})
