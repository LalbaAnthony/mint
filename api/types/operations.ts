import type { z } from 'zod'
import type { createOperationRequestSchema } from '@mint/shared/schemas/operations'
import type { TransactionModel } from './models.js'

export type OperationFields = z.output<typeof createOperationRequestSchema>

export type TransferMovements = {
  source: TransactionModel
  target: TransactionModel
}
