import type { z } from 'zod'
import type {
  transactionOriginSchema,
  transactionStatusSchema,
} from '../schemas/transactions.js'

export type TransactionOrigin = z.infer<typeof transactionOriginSchema>

export type TransactionStatus = z.infer<typeof transactionStatusSchema>

export type OperationInput = {
  id: string
  accountId: string
  date: string
  amountCents: number
  categoryId: string | null
  transferGroupId: string | null
}

export type CategorizedMovement = Pick<
  OperationInput,
  'categoryId' | 'date' | 'amountCents'
>
