import type { z } from 'zod'
import { csrfTokenResponseSchema } from '@mint/shared/schemas/auth'
import { apiErrorResponseSchema } from '@mint/shared/schemas/errors'
import type { ValidationIssue } from '@mint/shared/types/errors'
import type { ApiErrorInit, ApiMethod, FetchFailure } from '~~/types/api'
import type { ApiMutationListener } from '~~/types/notifications'

const apiBase = '/api/v1'

let csrfToken: string | null = null

const mutationListeners = new Set<ApiMutationListener>()

export function onApiMutation(listener: ApiMutationListener): () => void {
  mutationListeners.add(listener)
  return () => {
    mutationListeners.delete(listener)
  }
}

function notifyMutation(path: string): void {
  for (const listener of mutationListeners) {
    listener(path)
  }
}

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
  const response = await send(method, path, body, token).catch(
    async (error: unknown) => {
      if (error instanceof ApiError && error.code === 'csrf_invalid') {
        return send(method, path, body, await refreshCsrfToken())
      }
      throw error
    },
  )
  notifyMutation(path)
  return response
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

async function sendFile(path: string, file: Blob, token: string) {
  try {
    return await $fetch(`${apiBase}${path}`, {
      method: 'POST',
      body: file,
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': token, 'Content-Type': 'text/csv' },
    })
  } catch (error) {
    throw toApiError(error)
  }
}

export async function apiUpload<Schema extends z.ZodType>(
  path: string,
  file: Blob,
  schema: Schema,
): Promise<z.output<Schema>> {
  const token = csrfToken ?? (await refreshCsrfToken())
  const response = await sendFile(path, file, token).catch(
    async (error: unknown) => {
      if (error instanceof ApiError && error.code === 'csrf_invalid') {
        return sendFile(path, file, await refreshCsrfToken())
      }
      throw error
    },
  )
  notifyMutation(path)
  return schema.parse(response)
}

async function readDownloadError(error: unknown): Promise<ApiError> {
  if (!isFetchFailure(error) || !(error.data instanceof Blob)) {
    return toApiError(error)
  }
  const text = await error.data.text()
  const parsed = apiErrorResponseSchema.safeParse(parseJson(text))
  return new ApiError({
    status: error.statusCode ?? 0,
    code: parsed.success ? parsed.data.error : 'internal_error',
    issues: parsed.success ? (parsed.data.issues ?? []) : [],
    retryAfterSeconds: parsed.success
      ? parsed.data.retryAfterSeconds
      : undefined,
  })
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

async function sendDownload(
  path: string,
  body: object,
  token: string,
): Promise<Blob> {
  try {
    return await $fetch(`${apiBase}${path}`, {
      method: 'POST',
      body,
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': token },
      responseType: 'blob',
    })
  } catch (error) {
    throw await readDownloadError(error)
  }
}

export async function apiDownload(path: string, body: object): Promise<Blob> {
  const token = csrfToken ?? (await refreshCsrfToken())
  return sendDownload(path, body, token).catch(async (error: unknown) => {
    if (error instanceof ApiError && error.code === 'csrf_invalid') {
      return sendDownload(path, body, await refreshCsrfToken())
    }
    throw error
  })
}
