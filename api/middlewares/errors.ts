import type { ErrorRequestHandler, RequestHandler } from 'express'
import { HttpError } from '../http/http-error.js'
import { describeError, log } from '../logger.js'

export const handleNotFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'not_found' })
}

function bodyParserStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    typeof error.type === 'string' &&
    error.type.startsWith('entity.') &&
    'status' in error &&
    typeof error.status === 'number' &&
    error.status >= 400 &&
    error.status < 500
  ) {
    return error.status
  }
  return undefined
}

function sendHttpError(
  error: HttpError,
  response: Parameters<ErrorRequestHandler>[2],
): void {
  if (error.status >= 500) {
    log('error', 'request_failed', {
      code: error.code,
      error: describeError(error.cause ?? error),
    })
  }
  if (error.details.retryAfterSeconds !== undefined) {
    response.set('Retry-After', String(error.details.retryAfterSeconds))
  }
  response.status(error.status).json({ error: error.code, ...error.details })
}

export const handleError: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  next,
) => {
  if (response.headersSent) {
    log('error', 'request_failed', { error: describeError(error) })
    next(error)
    return
  }
  if (error instanceof HttpError) {
    sendHttpError(error, response)
    return
  }
  const parserStatus = bodyParserStatus(error)
  if (parserStatus !== undefined) {
    response.status(parserStatus).json({ error: 'validation_failed' })
    return
  }
  log('error', 'request_failed', { error: describeError(error) })
  response.status(500).json({ error: 'internal_error' })
}
