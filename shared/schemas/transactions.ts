import { z } from 'zod'

export const transactionOrigins = ['manual', 'import', 'schedule'] as const

export const transactionStatuses = ['categorized', 'to_categorize'] as const

export const transactionOriginSchema = z
  .enum(transactionOrigins, { error: 'invalid' })
  .meta({ id: 'TransactionOrigin' })

export const transactionStatusSchema = z
  .enum(transactionStatuses, { error: 'invalid' })
  .meta({ id: 'TransactionStatus' })
