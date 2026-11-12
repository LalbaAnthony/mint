import express from 'express'
import request from 'supertest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app.js'
import { handleError } from './errors.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('handleNotFound', () => {
  it('answers 404 in JSON for an unknown route', async () => {
    const app = createApp({ checkDatabase: async () => true })

    const response = await request(app).get('/api/v1/unknown')

    expect(response.status).toBe(404)
    expect(response.body).toEqual({ error: 'not_found' })
  })
})

describe('handleError', () => {
  it('logs the error as JSON and answers 500 without details', async () => {
    const lines: string[] = []
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk) => {
      lines.push(String(chunk))
      return true
    })
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
})
