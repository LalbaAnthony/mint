import type { ErrorRequestHandler, RequestHandler } from 'express'
import { describeError, log } from '../logger.js'

export const handleNotFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'not_found' })
}

export const handleError: ErrorRequestHandler = (
  error,
  _request,
  response,
  next,
) => {
  log('error', 'request_failed', { error: describeError(error) })
  if (response.headersSent) {
    next(error)
    return
  }
  response.status(500).json({ error: 'internal_error' })
}
