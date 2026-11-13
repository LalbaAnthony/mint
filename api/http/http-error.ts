import type { ApiErrorCode } from '@mint/shared/types/errors'
import type { HttpErrorDetails, HttpErrorInit } from '../types/http.js'

export class HttpError extends Error {
  readonly status: number
  readonly code: ApiErrorCode
  readonly details: HttpErrorDetails

  constructor({ status, code, details = {} }: HttpErrorInit, cause?: unknown) {
    super(code, { cause })
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function notFound(): HttpError {
  return new HttpError({ status: 404, code: 'not_found' })
}

export function unauthenticated(): HttpError {
  return new HttpError({ status: 401, code: 'unauthenticated' })
}

export function tooManyAttempts(
  code: 'too_many_attempts' | 'account_locked',
  retryAfterSeconds: number,
): HttpError {
  return new HttpError({ status: 429, code, details: { retryAfterSeconds } })
}
