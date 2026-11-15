import type { z } from 'zod'
import type {
  csvDateFormats,
  csvMappingSchema,
  importBatchSchema,
  importBatchViewSchema,
  importCandidateSchema,
  importHistorySchema,
  importLineErrorSchema,
  importRowDecisionSchema,
  importRowSchema,
  validateImportRequestSchema,
} from '../schemas/imports.js'

export type CsvMapping = z.infer<typeof csvMappingSchema>

export type CsvDateFormat = (typeof csvDateFormats)[number]

export type ImportLineError = z.infer<typeof importLineErrorSchema>

export type ImportCandidate = z.infer<typeof importCandidateSchema>

export type ImportRow = z.infer<typeof importRowSchema>

export type ImportBatch = z.infer<typeof importBatchSchema>

export type ImportBatchView = z.infer<typeof importBatchViewSchema>

export type ImportHistory = z.infer<typeof importHistorySchema>

export type ImportRowDecision = z.infer<typeof importRowDecisionSchema>

export type ValidateImportRequest = z.infer<typeof validateImportRequestSchema>

export type InterpretedLine =
  | {
      rowIndex: number
      raw: string[]
      error: null
      date: string
      amountCents: number
      bankLabel: string
    }
  | {
      rowIndex: number
      raw: string[]
      error: ImportLineError
      date: string | null
      amountCents: number | null
      bankLabel: string | null
    }

export type DedupSource = {
  date: string
  amountCents: number
  bankLabel: string
}

export type AmountReading =
  | { amountCents: number; error: null }
  | {
      amountCents: null
      error:
        'missing_column' | 'invalid_amount' | 'amount_zero' | 'both_amounts'
    }
