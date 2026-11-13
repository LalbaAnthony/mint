import type { z } from 'zod'
import type {
  apiErrorCodeSchema,
  apiErrorResponseSchema,
  validationIssueSchema,
} from '../schemas/errors.js'

export type ApiErrorCode = z.infer<typeof apiErrorCodeSchema>

export type ValidationIssue = z.infer<typeof validationIssueSchema>

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>
