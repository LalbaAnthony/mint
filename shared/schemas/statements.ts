import { z } from 'zod'
import { amountCentsSchema, isoDateSchema } from './common.js'

export const createStatementRequestSchema = z
  .object({
    date: isoDateSchema,
    balanceCents: amountCentsSchema,
  })
  .meta({ id: 'CreateStatementRequest' })

export const statementSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    date: z.iso.date(),
    balanceCents: z.number().int(),
    calculatedBalanceCents: z.number().int(),
    gapCents: z.number().int(),
    adjustmentOperationId: z.uuid().nullable(),
  })
  .meta({ id: 'Statement' })

export const statementListResponseSchema = z
  .object({ statements: z.array(statementSchema) })
  .meta({ id: 'StatementListResponse' })
