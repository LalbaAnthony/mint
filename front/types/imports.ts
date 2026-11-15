import type {
  CsvMapping,
  ImportBatch,
  ImportBatchView,
  ImportRow,
} from '@mint/shared/types/imports'

export type ImportStep = 'select' | 'configure' | 'review'

export type AmountMode = 'signed' | 'split'

export type RowDecisionState = {
  include: boolean
  categoryId: string | null
  transferAccountId: string | null
  reconcileKey: string | null
}

export type ReviewFilter =
  'all' | 'toCategorize' | 'proposals' | 'duplicates' | 'errors'

export interface ImportMappingFormProps {
  view: ImportBatchView
  busy: boolean
}

export type ImportMappingFormEmits = {
  preview: [mapping: CsvMapping]
}

export interface ImportReviewProps {
  rows: ImportRow[]
  accountId: string
  busy: boolean
}

export type ImportReviewEmits = {
  validate: [decisions: Map<number, RowDecisionState>]
  back: []
}

export interface ImportHistoryProps {
  batches: ImportBatch[]
  busy: boolean
}

export type ImportHistoryEmits = {
  resume: [batch: ImportBatch]
  cancel: [batch: ImportBatch]
  abandon: [batch: ImportBatch]
}
