import express, { Router } from 'express'
import type { Express, RequestHandler } from 'express'
import { createCsrfVerifier } from './auth/csrf.js'
import { isSecureOrigin } from './auth/session.js'
import { createSessionMiddleware } from './auth/session-middleware.js'
import { defaultRequestBody } from './http/route.js'
import { handleError, handleNotFound } from './middlewares/errors.js'
import { apiRoutes } from './routes/index.js'
import type { AppDependencies } from './types/app.js'
import type { ApiRoute } from './types/http.js'

export const apiPrefix = '/api/v1'

const disableCaching: RequestHandler = (_request, response, next) => {
  response.set('Cache-Control', 'no-store')
  next()
}

function bodyParser(route: Pick<ApiRoute, 'requestBody'>): RequestHandler {
  const { requestBody } = route
  return requestBody.format === 'binary'
    ? express.raw({ limit: requestBody.limit, type: requestBody.mediaTypes })
    : express.json({ limit: requestBody.limit })
}

function mountHandler(
  router: Router,
  route: ApiRoute,
  handler: RequestHandler,
): void {
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

function createBodyParsers(): Router {
  const parsers = Router()
  for (const route of apiRoutes) {
    if (route.requestBody !== defaultRequestBody) {
      mountHandler(parsers, route, bodyParser(route))
    }
  }
  parsers.use(bodyParser({ requestBody: defaultRequestBody }))
  return parsers
}

function createApiRouter(app: AppDependencies): Router {
  const router = Router()
  router.use(disableCaching)
  router.use(createBodyParsers())
  router.use(createSessionMiddleware(app))
  router.use(
    createCsrfVerifier({
      secret: app.config.sessionSecret,
      secureCookies: isSecureOrigin(app.config.appOrigin),
    }),
  )
  for (const route of apiRoutes) {
    mountHandler(router, route, route.createHandler(app))
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
