import type { ValidationIssue } from '@mint/shared/types/errors'

export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export type ApiErrorInit = {
  status: number
  code: string
  issues: ValidationIssue[]
  retryAfterSeconds?: number
}

export type FetchFailure = {
  statusCode?: number
  data?: unknown
}
