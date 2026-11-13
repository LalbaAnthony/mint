import type { z } from 'zod'
import { csrfTokenResponseSchema } from '@mint/shared/schemas/auth'
import { apiErrorResponseSchema } from '@mint/shared/schemas/errors'
import type { ValidationIssue } from '@mint/shared/types/errors'
import type { ApiErrorInit, ApiMethod, FetchFailure } from '~~/types/api'

const apiBase = '/api/v1'

let csrfToken: string | null = null

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly issues: ValidationIssue[]
  readonly retryAfterSeconds: number | undefined

  constructor({ status, code, issues, retryAfterSeconds }: ApiErrorInit) {
    super(code)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.issues = issues
    this.retryAfterSeconds = retryAfterSeconds
  }
}

function isFetchFailure(error: unknown): error is FetchFailure {
  return typeof error === 'object' && error !== null && 'statusCode' in error
}

function toApiError(error: unknown): ApiError {
  if (!isFetchFailure(error)) {
    return new ApiError({ status: 0, code: 'network_error', issues: [] })
  }
  const parsed = apiErrorResponseSchema.safeParse(error.data)
  return new ApiError({
    status: error.statusCode ?? 0,
    code: parsed.success ? parsed.data.error : 'internal_error',
    issues: parsed.success ? (parsed.data.issues ?? []) : [],
    retryAfterSeconds: parsed.success
      ? parsed.data.retryAfterSeconds
      : undefined,
  })
}

async function send(
  method: ApiMethod,
  path: string,
  body: object | undefined,
  token: string | null,
): Promise<unknown> {
  try {
    return await $fetch(`${apiBase}${path}`, {
      method,
      body,
      credentials: 'same-origin',
      headers: token === null ? {} : { 'X-CSRF-Token': token },
    })
  } catch (error) {
    throw toApiError(error)
  }
}

async function refreshCsrfToken(): Promise<string> {
  const response = await send('GET', '/csrf', undefined, null)
  csrfToken = csrfTokenResponseSchema.parse(response).token
  return csrfToken
}

export function resetCsrfToken(): void {
  csrfToken = null
}

export async function apiRequest(
  method: ApiMethod,
  path: string,
  body?: object,
): Promise<unknown> {
  if (method === 'GET') {
    return send(method, path, undefined, null)
  }
  const token = csrfToken ?? (await refreshCsrfToken())
  try {
    return await send(method, path, body, token)
  } catch (error) {
    if (error instanceof ApiError && error.code === 'csrf_invalid') {
      return send(method, path, body, await refreshCsrfToken())
    }
    throw error
  }
}

export async function apiGet<Schema extends z.ZodType>(
  path: string,
  schema: Schema,
): Promise<z.output<Schema>> {
  return schema.parse(await apiRequest('GET', path))
}

export async function apiCall<Schema extends z.ZodType>(
  method: Exclude<ApiMethod, 'GET'>,
  path: string,
  schema: Schema,
  body?: object,
): Promise<z.output<Schema>> {
  return schema.parse(await apiRequest(method, path, body))
}

export async function apiCommand(
  method: Exclude<ApiMethod, 'GET'>,
  path: string,
  body?: object,
): Promise<void> {
  await apiRequest(method, path, body)
}
