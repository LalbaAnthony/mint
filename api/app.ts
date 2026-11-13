import express, { Router } from 'express'
import type { Express, RequestHandler } from 'express'
import { createCsrfVerifier } from './auth/csrf.js'
import { isSecureOrigin } from './auth/session.js'
import { createSessionMiddleware } from './auth/session-middleware.js'
import { handleError, handleNotFound } from './middlewares/errors.js'
import { apiRoutes } from './routes/index.js'
import type { AppDependencies } from './types/app.js'
import type { ApiRoute } from './types/http.js'

export const apiPrefix = '/api/v1'

const disableCaching: RequestHandler = (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
}

function mountRoute(router: Router, route: ApiRoute, app: AppDependencies) {
  const handler = route.createHandler(app)
  switch (route.method) {
    case 'get':
      router.get(route.path, handler)
      break
    case 'post':
      router.post(route.path, handler)
      break
    case 'patch':
      router.patch(route.path, handler)
      break
    case 'delete':
      router.delete(route.path, handler)
      break
  }
}

function createApiRouter(app: AppDependencies): Router {
  const router = Router()
  router.use(disableCaching)
  router.use(express.json({ limit: '16kb' }))
  router.use(createSessionMiddleware(app))
  router.use(
    createCsrfVerifier({
      secret: app.config.sessionSecret,
      secureCookies: isSecureOrigin(app.config.appOrigin),
    }),
  )
  for (const route of apiRoutes) {
    mountRoute(router, route, app)
  }
  return router
}

export function createApp(app: AppDependencies): Express {
  const server = express()
  server.disable('x-powered-by')
  server.set('trust proxy', 1)
  server.use(apiPrefix, createApiRouter(app))
  server.use(handleNotFound)
  server.use(handleError)
  return server
}
