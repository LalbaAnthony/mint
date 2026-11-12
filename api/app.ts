import express from 'express'
import type { Express } from 'express'
import { handleError, handleNotFound } from './middlewares/errors.js'
import { createHealthRouter } from './routes/health.js'
import type { AppDependencies } from './types/app.js'

export function createApp(dependencies: AppDependencies): Express {
  const app = express()
  app.disable('x-powered-by')
  app.use('/api/v1', createHealthRouter(dependencies))
  app.use(handleNotFound)
  app.use(handleError)
  return app
}
