import type { z } from 'zod'
import type {
  createStatementRequestSchema,
  statementListResponseSchema,
  statementSchema,
} from '../schemas/statements.js'

export type CreateStatementRequest = z.infer<
  typeof createStatementRequestSchema
>

export type Statement = z.infer<typeof statementSchema>

export type StatementListResponse = z.infer<typeof statementListResponseSchema>
