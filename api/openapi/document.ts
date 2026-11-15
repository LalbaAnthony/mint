import {
  OpenAPIRegistry,
  OpenApiGeneratorV31,
} from '@asteasolutions/zod-to-openapi'
import type { ResponseConfig } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'
import { apiPrefix } from '../app.js'
import { csrfHeaderName } from '../auth/csrf.js'
import { sessionCookieName } from '../auth/session.js'
import { noBody, noParams, noQuery } from '../schemas/http.js'
import type { ApiRoute, RouteResponse } from '../types/http.js'

const csrfHeaders = z.object({
  [csrfHeaderName]: z
    .string()
    .meta({ description: 'Token returned by GET /api/v1/csrf' }),
})

function toOpenApiPath(path: string): string {
  return `${apiPrefix}${path.replace(/:([A-Za-z]+)/g, '{$1}')}`
}

function toResponseConfig(response: RouteResponse): ResponseConfig {
  if (response.schema === undefined) {
    return { description: response.description }
  }
  return {
    description: response.description,
    content: { 'application/json': { schema: response.schema } },
  }
}

function registerRoute(registry: OpenAPIRegistry, route: ApiRoute): void {
  registry.registerPath({
    method: route.method,
    path: toOpenApiPath(route.path),
    summary: route.summary,
    tags: [route.tag],
    security: route.access === 'public' ? [] : [{ session: [] }],
    request: {
      ...(route.params === noParams ? {} : { params: route.params }),
      ...(route.query === noQuery ? {} : { query: route.query }),
      ...(route.method === 'get' ? {} : { headers: csrfHeaders }),
      ...(route.body === noBody
        ? {}
        : {
            body: {
              required: true,
              content:
                route.requestBody.format === 'binary'
                  ? Object.fromEntries(
                      route.requestBody.mediaTypes.map((mediaType) => [
                        mediaType,
                        { schema: { type: 'string', format: 'binary' } },
                      ]),
                    )
                  : { 'application/json': { schema: route.body } },
            },
          }),
    },
    responses: Object.fromEntries(
      Object.entries(route.responses).map(([status, response]) => [
        status,
        toResponseConfig(response),
      ]),
    ),
  })
}

export function buildOpenApiDocument(routes: ApiRoute[]) {
  const registry = new OpenAPIRegistry()
  registry.registerComponent('securitySchemes', 'session', {
    type: 'apiKey',
    in: 'cookie',
    name: sessionCookieName(true),
  })
  for (const route of routes) {
    registerRoute(registry, route)
  }
  return new OpenApiGeneratorV31(registry.definitions).generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'Mint API',
      version: '1',
      description:
        'REST JSON API of Mint. Every modifying request carries the X-CSRF-Token header. Generated from the zod schemas: do not edit by hand.',
    },
    servers: [{ url: '/' }],
  })
}
