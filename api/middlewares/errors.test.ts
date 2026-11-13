import express from 'express'
import request from 'supertest'
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { HttpError } from '../http/http-error.js'
import { createTestContext } from '../tests/context.js'
import type { TestContext } from '../types/tests.js'
import { handleError } from './errors.js'

function captureStdout(): string[] {
  const lines: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
    lines.push(String(chunk))
    return true
  })
  return lines
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('handleNotFound', () => {
  let context: TestContext

  beforeAll(async () => {
    context = await createTestContext()
  })

  afterAll(async () => {
    await context.close()
  })

  it('answers 404 in JSON for an unknown route', async () => {
    const response = await request(context.server).get('/api/v1/unknown')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'not_found' })
  })

  it('answers 400 to a malformed JSON body', async () => {
    const response = await request(context.server)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')

    expect(response.status).toBe(400)
    expect(response.body).toEqual({ error: 'validation_failed' })
  })
})

describe('handleError', () => {
  it('logs the error as JSON and answers 500 without details', async () => {
    const lines = captureStdout()
    const app = express()
    app.get('/failure', () => {
      throw new Error('database timeout')
    })
    app.use(handleError)

    const response = await request(app).get('/failure')

    expect(response.status).toBe(500)
    expect(response.body).toEqual({ error: 'internal_error' })
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({
        level: 'error',
        event: 'request_failed',
        error: 'database timeout',
      }),
    ])
  })

  it('answers an HttpError with its code, details and Retry-After', async () => {
    const lines = captureStdout()
    const app = express()
    app.get('/locked', () => {
      throw new HttpError({
        status: 429,
        code: 'account_locked',
        details: { retryAfterSeconds: 900 },
      })
    })
    app.use(handleError)

    const response = await request(app).get('/locked')

    expect(response.status).toBe(429)
    expect(response.headers['retry-after']).toBe('900')
    expect(response.body).toEqual({
      error: 'account_locked',
      retryAfterSeconds: 900,
    })
    expect(lines).toEqual([])
  })

  it('logs the cause of a 5xx HttpError', async () => {
    const lines = captureStdout()
    const app = express()
    app.get('/mail', () => {
      throw new HttpError(
        { status: 502, code: 'mail_delivery_failed' },
        new Error('SMTP unavailable'),
      )
    })
    app.use(handleError)

    const response = await request(app).get('/mail')

    expect(response.status).toBe(502)
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      expect.objectContaining({
        event: 'request_failed',
        code: 'mail_delivery_failed',
        error: 'SMTP unavailable',
      }),
    ])
  })
})
