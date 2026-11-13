import { z } from 'zod'
import { definePublicRoute } from '../http/route.js'
import { noBody, noParams } from '../schemas/http.js'

const checkStatusSchema = z.enum(['ok', 'unavailable'])

const healthResponseSchema = z
  .object({
    status: checkStatusSchema,
    checks: z.object({ api: z.literal('ok'), database: checkStatusSchema }),
  })
  .meta({ id: 'HealthResponse' })

export const healthRoute = definePublicRoute({
  method: 'get',
  path: '/health',
  summary: 'Check that the API and the database answer',
  tag: 'operations',
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'API and database available',
      schema: healthResponseSchema,
    },
    503: { description: 'Database unavailable', schema: healthResponseSchema },
  },
  handle: async ({ app }) => {
    const database = (await app.checkDatabase()) ? 'ok' : 'unavailable'
    return {
      status: database === 'ok' ? 200 : 503,
      body: { status: database, checks: { api: 'ok', database } },
    }
  },
})
