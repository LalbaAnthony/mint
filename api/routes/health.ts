import { Router } from 'express'
import type { HealthDependencies } from '../types/app.js'

export function createHealthRouter(dependencies: HealthDependencies): Router {
  const router = Router()

  router.get('/health', async (_request, response) => {
    const databaseStatus = (await dependencies.checkDatabase())
      ? 'ok'
      : 'unavailable'
    response
      .status(databaseStatus === 'ok' ? 200 : 503)
      .set('Cache-Control', 'no-store')
      .json({
        status: databaseStatus,
        checks: { api: 'ok', database: databaseStatus },
      })
  })

  return router
}
