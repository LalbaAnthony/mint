import type { z } from 'zod'
import type {
  createOperationRequestSchema,
  createTransferRequestSchema,
  operationDirectionSchema,
  operationGroupSchema,
  operationListQuerySchema,
  operationListResponseSchema,
  operationSchema,
  operationSortFieldSchema,
  sortOrderSchema,
  transferSchema,
  updateOperationRequestSchema,
  updateTransferRequestSchema,
} from '../schemas/operations.js'
import type { usageCountsSchema } from '../schemas/usage.js'

export type OperationDirection = z.infer<typeof operationDirectionSchema>

export type OperationGroup = z.infer<typeof operationGroupSchema>

export type OperationSortField = z.infer<typeof operationSortFieldSchema>

export type SortOrder = z.infer<typeof sortOrderSchema>

export type CreateOperationRequest = z.infer<
  typeof createOperationRequestSchema
>

export type UpdateOperationRequest = z.infer<
  typeof updateOperationRequestSchema
>

export type CreateTransferRequest = z.infer<typeof createTransferRequestSchema>

export type UpdateTransferRequest = z.infer<typeof updateTransferRequestSchema>

export type Operation = z.infer<typeof operationSchema>

export type Transfer = z.infer<typeof transferSchema>

export type OperationListQuery = z.infer<typeof operationListQuerySchema>

export type OperationListQueryInput = z.input<typeof operationListQuerySchema>

export type OperationListResponse = z.infer<typeof operationListResponseSchema>

export type UsageCounts = z.infer<typeof usageCountsSchema>
