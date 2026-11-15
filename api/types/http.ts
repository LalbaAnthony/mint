import type { Request, RequestHandler, Response } from 'express'
import type { z } from 'zod'
import type { ApiErrorCode } from '@mint/shared/types/errors'
import type { AppDependencies } from './app.js'
import type { UserModel } from './models.js'
import type { noQuery } from '../schemas/http.js'

export type RouteAccess = 'public' | 'user' | 'admin'

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete'

export type RouteContext<
  User extends UserModel | null,
  Body extends z.ZodType,
  Params extends z.ZodObject,
  Query extends z.ZodObject = typeof noQuery,
> = {
  request: Request
  response: Response
  app: AppDependencies
  user: User
  body: z.output<Body>
  params: z.output<Params>
  query: z.output<Query>
}

export type RouteRequestBody =
  | { format: 'json'; limit: string | number }
  | { format: 'binary'; limit: string | number; mediaTypes: string[] }

export type RouteResult = {
  status: number
  body?: unknown
}

export type RouteResponse = {
  description: string
  schema?: z.ZodType
}

export type RouteDefinition<
  User extends UserModel | null,
  Body extends z.ZodType,
  Params extends z.ZodObject,
  Query extends z.ZodObject = typeof noQuery,
> = {
  method: HttpMethod
  path: string
  summary: string
  tag: string
  body: Body
  requestBody?: RouteRequestBody
  params: Params
  query?: Query
  responses: Record<number, RouteResponse>
  handle: (
    context: RouteContext<User, Body, Params, Query>,
  ) => Promise<RouteResult> | RouteResult
}

export type ApiRoute = {
  method: HttpMethod
  path: string
  access: RouteAccess
  summary: string
  tag: string
  body: z.ZodType
  requestBody: RouteRequestBody
  params: z.ZodObject
  query: z.ZodObject
  responses: Record<number, RouteResponse>
  createHandler: (app: AppDependencies) => RequestHandler
}

export type ValidationIssueDetails = {
  path: (string | number)[]
  message: string
}

export type HttpErrorDetails = {
  issues?: ValidationIssueDetails[]
  retryAfterSeconds?: number
}

export type HttpErrorInit = {
  status: number
  code: ApiErrorCode
  details?: HttpErrorDetails
}
