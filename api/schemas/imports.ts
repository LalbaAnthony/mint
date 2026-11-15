import { z } from 'zod'
import { importCandidateSchema } from '@mint/shared/schemas/imports'
import {
  transactionOriginSchema,
  transactionStatusSchema,
} from '@mint/shared/schemas/transactions'

export const operationSnapshotSchema = z.object({
  date: z.iso.date(),
  amountCents: z.number().int(),
  label: z.string(),
  bankLabel: z.string().nullable(),
  origin: transactionOriginSchema,
  importBatchId: z.uuid().nullable(),
  dedupHash: z.string().nullable(),
  categoryId: z.uuid().nullable(),
  status: transactionStatusSchema,
  transferGroupId: z.uuid().nullable(),
})

export const storedCandidatesSchema = z.array(importCandidateSchema)

export const storedRawRowSchema = z.array(z.string())
