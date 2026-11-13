import type { Request, RequestHandler, Response } from 'express'
import type { z } from 'zod'
import type { ApiErrorCode } from '@mint/shared/types/errors'
import type { AppDependencies } from './app.js'
import type { UserModel } from './models.js'

export type RouteAccess = 'public' | 'user' | 'admin'

export type HttpMethod = 'get' | 'post' | 'patch' | 'delete'

export type RouteContext<
  User extends UserModel | null,
  Body extends z.ZodType,
  Params extends z.ZodObject,
> = {
  request: Request
  response: Response
  app: AppDependencies
  user: User
  body: z.output<Body>
  params: z.output<Params>
}

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
> = {
  method: HttpMethod
  path: string
  summary: string
  tag: string
  body: Body
  params: Params
  responses: Record<number, RouteResponse>
  handle: (
    context: RouteContext<User, Body, Params>,
  ) => Promise<RouteResult> | RouteResult
}

export type ApiRoute = {
  method: HttpMethod
  path: string
  access: RouteAccess
  summary: string
  tag: string
  body: z.ZodType
  params: z.ZodObject
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
