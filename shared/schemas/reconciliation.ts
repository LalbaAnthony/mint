import { z } from 'zod'
import { importCandidateSchema } from './imports.js'

export const reconcileRequestSchema = z
  .object({
    scheduleId: z.uuid({ error: 'invalid' }),
    originalDate: z.iso.date({ error: 'invalid_date' }),
  })
  .meta({ id: 'ReconcileRequest' })

export const candidateListResponseSchema = z
  .object({ candidates: z.array(importCandidateSchema) })
  .meta({ id: 'CandidateListResponse' })

export const convertToTransferRequestSchema = z
  .object({ counterpartAccountId: z.uuid({ error: 'required' }) })
  .meta({ id: 'ConvertToTransferRequest' })
