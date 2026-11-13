import type { Request, Response } from 'express'
import type { z } from 'zod'
import type { AppDependencies } from '../types/app.js'
import type {
  ApiRoute,
  RouteAccess,
  RouteDefinition,
  RouteResponse,
  RouteResult,
  ValidationIssueDetails,
} from '../types/http.js'
import type { UserModel } from '../types/models.js'
import { endSession } from '../auth/session.js'
import { HttpError, notFound, unauthenticated } from './http-error.js'

function toIssues(error: z.ZodError): ValidationIssueDetails[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) =>
      typeof segment === 'symbol' ? String(segment) : segment,
    ),
    message: issue.message,
  }))
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

function buildRoute<
  User extends UserModel | null,
  Body extends z.ZodType,
  Params extends z.ZodObject,
>(
  access: RouteAccess,
  resolveUser: (
    request: Request,
    response: Response,
    app: AppDependencies,
  ) => Promise<User>,
  definition: RouteDefinition<User, Body, Params>,
): ApiRoute {
  return {
    method: definition.method,
    path: definition.path,
    access,
    summary: definition.summary,
    tag: definition.tag,
    body: definition.body,
    params: definition.params,
    responses: definition.responses,
    createHandler: (app) => async (request, response) => {
      const user = await resolveUser(request, response, app)
      const params = definition.params.safeParse(request.params)
      if (!params.success) {
        throw notFound()
      }
      const body = definition.body.safeParse(request.body)
      if (!body.success) {
        throw new HttpError({
          status: 400,
          code: 'validation_failed',
          details: { issues: toIssues(body.error) },
        })
      }
      const result = await definition.handle({
        request,
        response,
        app,
        user,
        body: body.data,
        params: params.data,
      })
      sendResult(response, definition.responses, result)
    },
  }
}

export function definePublicRoute<
  Body extends z.ZodType,
  Params extends z.ZodObject,
>(definition: RouteDefinition<null, Body, Params>): ApiRoute {
  return buildRoute('public', resolveAnonymous, definition)
}

export function defineUserRoute<
  Body extends z.ZodType,
  Params extends z.ZodObject,
>(definition: RouteDefinition<UserModel, Body, Params>): ApiRoute {
  return buildRoute('user', resolveActiveUser, definition)
}

export function defineAdminRoute<
  Body extends z.ZodType,
  Params extends z.ZodObject,
>(definition: RouteDefinition<UserModel, Body, Params>): ApiRoute {
  return buildRoute('admin', resolveAdministrator, definition)
}
