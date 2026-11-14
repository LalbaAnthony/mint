import type { z } from 'zod'
import type { ApiErrorCode } from '@mint/shared/types/errors'
import type {
  HttpErrorDetails,
  HttpErrorInit,
  ValidationIssueDetails,
} from '../types/http.js'

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

export function conflict(code: ApiErrorCode): HttpError {
  return new HttpError({ status: 409, code })
}

export function toIssues(error: z.ZodError): ValidationIssueDetails[] {
  return error.issues.map((issue) => ({
    path: issue.path.map((segment) =>
      typeof segment === 'symbol' ? String(segment) : segment,
    ),
    message: issue.message,
  }))
}

export function validationFailed(issues: ValidationIssueDetails[]): HttpError {
  return new HttpError({
    status: 400,
    code: 'validation_failed',
    details: { issues },
  })
}

export function tooManyAttempts(
  code: 'too_many_attempts' | 'account_locked',
  retryAfterSeconds: number,
): HttpError {
  return new HttpError({ status: 429, code, details: { retryAfterSeconds } })
}
