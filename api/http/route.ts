import type { Request, Response } from 'express'
import type { z } from 'zod'
import type { AppDependencies } from '../types/app.js'
import type {
  ApiRoute,
  RouteAccess,
  RouteDefinition,
  RouteRequestBody,
  RouteResponse,
  RouteResult,
} from '../types/http.js'
import type { UserModel } from '../types/models.js'
import { endSession } from '../auth/session.js'
import { noQuery } from '../schemas/http.js'
import {
  HttpError,
  notFound,
  toIssues,
  unauthenticated,
  validationFailed,
} from './http-error.js'

export const defaultRequestBody: RouteRequestBody = {
  format: 'json',
  limit: '16kb',
}

function sendResult(
  response: Response,
  responses: Record<number, RouteResponse>,
  result: RouteResult,
): void {
  const declared = responses[result.status]
  if (declared === undefined) {
    throw new Error(`Undeclared response status ${result.status}`)
  }
  if (declared.schema === undefined) {
    response.status(result.status).end()
    return
  }
  response.status(result.status).json(declared.schema.parse(result.body))
}

async function resolveAnonymous(): Promise<null> {
  return null
}

async function resolveActiveUser(
  request: Request,
  response: Response,
  app: AppDependencies,
): Promise<UserModel> {
  const userId = request.session.userId
  if (userId === undefined) {
    throw unauthenticated()
  }
  const user = await app.models.User.findByPk(userId)
  if (user === null || user.status !== 'active') {
    await endSession(request, response, app)
    throw unauthenticated()
  }
  return user
}

async function resolveAdministrator(
  request: Request,
  response: Response,
  app: AppDependencies,
): Promise<UserModel> {
  const user = await resolveActiveUser(request, response, app)
  if (user.role !== 'admin') {
    throw new HttpError({ status: 403, code: 'forbidden' })
  }
  return user
}

const alertNeutralTags: ReadonlySet<string> = new Set([
  'administration',
  'auth',
  'notifications',
])

function buildRoute<
  User extends UserModel | null,
  Body extends z.ZodType,
  Params extends z.ZodObject,
  Query extends z.ZodObject,
>(
  access: RouteAccess,
  resolveUser: (
    request: Request,
    response: Response,
    app: AppDependencies,
  ) => Promise<User>,
  definition: RouteDefinition<User, Body, Params, Query>,
  querySchema: Query,
): ApiRoute {
  return {
    method: definition.method,
    path: definition.path,
    access,
    summary: definition.summary,
    tag: definition.tag,
    body: definition.body,
    requestBody: definition.requestBody ?? defaultRequestBody,
    params: definition.params,
    query: querySchema,
    responses: definition.responses,
    createHandler: (app) => async (request, response) => {
      const user = await resolveUser(request, response, app)
      const params = definition.params.safeParse(request.params)
      if (!params.success) {
        throw notFound()
      }
      const query = querySchema.safeParse(request.query)
      if (!query.success) {
        throw validationFailed(toIssues(query.error))
      }
      const body = definition.body.safeParse(request.body)
      if (!body.success) {
        throw validationFailed(toIssues(body.error))
      }
      const result = await definition.handle({
        request,
        response,
        app,
        user,
        body: body.data,
        params: params.data,
        query: query.data,
      })
      sendResult(response, definition.responses, result)
      if (
        user !== null &&
        definition.method !== 'get' &&
        !alertNeutralTags.has(definition.tag)
      ) {
        app.alerts.schedule(user.id)
      }
    },
  }
}

export function definePublicRoute<
  Body extends z.ZodType,
  Params extends z.ZodObject,
  Query extends z.ZodObject = typeof noQuery,
>(definition: RouteDefinition<null, Body, Params, Query>): ApiRoute {
  return buildRoute(
    'public',
    resolveAnonymous,
    definition,
    definition.query ?? noQuery,
  )
}

export function defineUserRoute<
  Body extends z.ZodType,
  Params extends z.ZodObject,
  Query extends z.ZodObject = typeof noQuery,
>(definition: RouteDefinition<UserModel, Body, Params, Query>): ApiRoute {
  return buildRoute(
    'user',
    resolveActiveUser,
    definition,
    definition.query ?? noQuery,
  )
}

export function defineAdminRoute<
  Body extends z.ZodType,
  Params extends z.ZodObject,
  Query extends z.ZodObject = typeof noQuery,
>(definition: RouteDefinition<UserModel, Body, Params, Query>): ApiRoute {
  return buildRoute(
    'admin',
    resolveAdministrator,
    definition,
    definition.query ?? noQuery,
  )
}
