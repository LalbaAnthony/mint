import { z } from 'zod'

export const importFileMaxBytes = 5 * 1024 * 1024

export const csvDelimiters = ['semicolon', 'comma', 'tab'] as const

export const csvEncodings = ['utf-8', 'windows-1252'] as const

export const csvDateFormats = [
  'DD/MM/YYYY',
  'DD/MM/YY',
  'DD-MM-YYYY',
  'DD.MM.YYYY',
  'YYYY-MM-DD',
  'MM/DD/YYYY',
] as const

export const csvDecimalSeparators = ['comma', 'dot'] as const

export const importBatchStatuses = [
  'pending',
  'validated',
  'cancelled',
] as const

export const importLineErrors = [
  'missing_column',
  'invalid_date',
  'invalid_amount',
  'amount_zero',
  'both_amounts',
  'missing_label',
  'date_before_initial_balance',
] as const

const columnSchema = z
  .number({ error: 'invalid' })
  .int({ error: 'invalid' })
  .min(0, { error: 'invalid' })
  .max(99, { error: 'invalid' })

const skipSchema = z
  .number({ error: 'invalid' })
  .int({ error: 'invalid' })
  .min(0, { error: 'invalid' })
  .max(100, { error: 'invalid' })

export const csvMappingSchema = z
  .object({
    delimiter: z.enum(csvDelimiters, { error: 'invalid' }),
    encoding: z.enum(csvEncodings, { error: 'invalid' }),
    hasHeader: z.boolean({ error: 'invalid' }),
    skipTop: skipSchema,
    skipBottom: skipSchema,
    dateFormat: z.enum(csvDateFormats, { error: 'invalid' }),
    decimalSeparator: z.enum(csvDecimalSeparators, { error: 'invalid' }),
    colDate: columnSchema,
    colLabel: columnSchema,
    colAmount: columnSchema.nullable(),
    colDebit: columnSchema.nullable(),
    colCredit: columnSchema.nullable(),
  })
  .refine(
    (mapping) =>
      mapping.colAmount === null
        ? mapping.colDebit !== null && mapping.colCredit !== null
        : mapping.colDebit === null && mapping.colCredit === null,
    { error: 'amount_columns', path: ['colAmount'] },
  )
  .meta({ id: 'CsvMapping' })

export const importLineErrorSchema = z
  .enum(importLineErrors)
  .meta({ id: 'ImportLineError' })

export const importCandidateSchema = z
  .object({
    scheduleId: z.uuid(),
    scheduleLabel: z.string(),
    originalDate: z.iso.date(),
    effectiveDate: z.iso.date(),
    amountCents: z.number().int(),
    operationId: z.uuid().nullable(),
    score: z.number(),
  })
  .meta({ id: 'ImportCandidate' })

export const importRowSchema = z
  .object({
    rowIndex: z.number().int(),
    raw: z.array(z.string()),
    date: z.iso.date().nullable(),
    amountCents: z.number().int().nullable(),
    bankLabel: z.string().nullable(),
    error: importLineErrorSchema.nullable(),
    duplicate: z.boolean(),
    ruleId: z.uuid().nullable(),
    categoryId: z.uuid().nullable(),
    transferAccountId: z.uuid().nullable(),
    tagIds: z.array(z.uuid()),
    candidates: z.array(importCandidateSchema),
  })
  .meta({ id: 'ImportRow' })

export const importBatchSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    filename: z.string(),
    status: z.enum(importBatchStatuses),
    rowsRead: z.number().int(),
    rowsCreated: z.number().int(),
    rowsDuplicate: z.number().int(),
    rowsMerged: z.number().int(),
    createdAt: z.iso.datetime(),
    validatedAt: z.iso.datetime().nullable(),
    cancelledAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'ImportBatch' })

export const importBatchViewSchema = z
  .object({
    batch: importBatchSchema,
    mapping: csvMappingSchema,
    mappingRemembered: z.boolean(),
    sampleLines: z.array(z.array(z.string())),
    rows: z.array(importRowSchema),
  })
  .meta({ id: 'ImportBatchView' })

export const importHistorySchema = z
  .object({ batches: z.array(importBatchSchema) })
  .meta({ id: 'ImportHistory' })

export const importFileQuerySchema = z
  .object({
    filename: z
      .string({ error: 'required' })
      .trim()
      .min(1, { error: 'required' })
      .max(200, { error: 'too_long' }),
  })
  .meta({ id: 'ImportFileQuery' })

export const importRowDecisionSchema = z
  .object({
    rowIndex: z.number({ error: 'invalid' }).int({ error: 'invalid' }),
    include: z.boolean({ error: 'invalid' }),
    categoryId: z.uuid({ error: 'invalid' }).nullable(),
    transferAccountId: z.uuid({ error: 'invalid' }).nullable(),
    reconcile: z
      .object({
        scheduleId: z.uuid({ error: 'invalid' }),
        originalDate: z.iso.date({ error: 'invalid_date' }),
      })
      .nullable(),
  })
  .refine(
    (decision) =>
      decision.categoryId === null || decision.transferAccountId === null,
    { error: 'single_action', path: ['transferAccountId'] },
  )
  .meta({ id: 'ImportRowDecision' })

export const validateImportRequestSchema = z
  .object({
    mapping: csvMappingSchema,
    decisions: z
      .array(importRowDecisionSchema, { error: 'invalid' })
      .max(20_000, { error: 'too_long' }),
  })
  .meta({ id: 'ValidateImportRequest' })

export const previewImportRequestSchema = z
  .object({ mapping: csvMappingSchema })
  .meta({ id: 'PreviewImportRequest' })

export const importMediaTypes = [
  'text/csv',
  'text/plain',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream',
]
