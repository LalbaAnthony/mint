import type { z } from 'zod'
import type {
  candidateListResponseSchema,
  convertToTransferRequestSchema,
  reconcileRequestSchema,
} from '../schemas/reconciliation.js'

export type ReconcileRequest = z.infer<typeof reconcileRequestSchema>

export type CandidateListResponse = z.infer<typeof candidateListResponseSchema>

export type ConvertToTransferRequest = z.infer<
  typeof convertToTransferRequestSchema
>
