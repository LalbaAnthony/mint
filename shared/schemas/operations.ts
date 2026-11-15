import { z } from 'zod'
import {
  amountCentsSchema,
  isoDateSchema,
  labelSchema,
  maxAmountCents,
} from './common.js'
import {
  transactionOriginSchema,
  transactionStatusSchema,
} from './transactions.js'

export const noteMaxLength = 1000

export const operationDirections = ['debit', 'credit'] as const

export const operationGroups = ['needs', 'wants', 'save'] as const

export const operationSortFields = ['date', 'amount'] as const

export const sortOrders = ['asc', 'desc'] as const

export const operationPageSizes = [25, 50, 100] as const

export const operationDirectionSchema = z
  .enum(operationDirections, { error: 'invalid' })
  .meta({ id: 'OperationDirection' })

export const operationGroupSchema = z
  .enum(operationGroups, { error: 'invalid' })
  .meta({ id: 'OperationGroup' })

export const operationSortFieldSchema = z
  .enum(operationSortFields, { error: 'invalid' })
  .meta({ id: 'OperationSortField' })

export const sortOrderSchema = z
  .enum(sortOrders, { error: 'invalid' })
  .meta({ id: 'SortOrder' })

export const noteSchema = z
  .string({ error: 'invalid' })
  .trim()
  .max(noteMaxLength, { error: 'too_long' })
  .nullable()
  .transform((text) => (text === null || text === '' ? null : text))

export const positiveAmountCentsSchema = z
  .number({ error: 'invalid_amount' })
  .int({ error: 'invalid_amount' })
  .min(1, { error: 'amount_not_positive' })
  .max(maxAmountCents, { error: 'amount_out_of_range' })

export const signedAmountCentsSchema = amountCentsSchema.refine(
  (amount) => amount !== 0,
  { error: 'amount_zero' },
)

const optionalIdSchema = z.uuid({ error: 'invalid' }).nullable()

export const operationFieldsSchema = z.object({
  accountId: z.uuid({ error: 'required' }),
  paymentMethodId: optionalIdSchema,
  date: isoDateSchema,
  amountCents: signedAmountCentsSchema,
  label: labelSchema,
  note: noteSchema,
  categoryId: optionalIdSchema,
})

export const createOperationRequestSchema = operationFieldsSchema.meta({
  id: 'CreateOperationRequest',
})

export const updateOperationRequestSchema = operationFieldsSchema
  .partial()
  .meta({ id: 'UpdateOperationRequest' })

export const transferFieldsSchema = z.object({
  sourceAccountId: z.uuid({ error: 'required' }),
  targetAccountId: z.uuid({ error: 'required' }),
  date: isoDateSchema,
  amountCents: positiveAmountCentsSchema,
  label: labelSchema,
  note: noteSchema,
})

export function sameAccountIssue(transfer: {
  sourceAccountId: string
  targetAccountId: string
}): boolean {
  return transfer.sourceAccountId === transfer.targetAccountId
}

export const createTransferRequestSchema = transferFieldsSchema
  .refine((transfer) => !sameAccountIssue(transfer), {
    error: 'same_account',
    path: ['targetAccountId'],
  })
  .meta({ id: 'CreateTransferRequest' })

export const updateTransferRequestSchema = transferFieldsSchema
  .partial()
  .meta({ id: 'UpdateTransferRequest' })

export const operationSchema = z
  .object({
    id: z.uuid(),
    accountId: z.uuid(),
    paymentMethodId: z.uuid().nullable(),
    date: z.iso.date(),
    amountCents: z.number().int(),
    label: z.string(),
    note: z.string().nullable(),
    categoryId: z.uuid().nullable(),
    status: transactionStatusSchema,
    origin: transactionOriginSchema,
    transferGroupId: z.uuid().nullable(),
    counterpartAccountId: z.uuid().nullable(),
    scheduleId: z.uuid().nullable(),
  })
  .meta({ id: 'Operation' })

export const transferSchema = z
  .object({
    transferGroupId: z.uuid(),
    source: operationSchema,
    target: operationSchema,
  })
  .meta({ id: 'Transfer' })

function asList<Schema extends z.ZodType>(item: Schema) {
  return z.preprocess(
    (value) => (value === undefined || Array.isArray(value) ? value : [value]),
    z.array(item).max(200, { error: 'too_long' }).optional(),
  )
}

const centsQuerySchema = z.coerce
  .number({ error: 'invalid_amount' })
  .int({ error: 'invalid_amount' })
  .min(0, { error: 'amount_out_of_range' })
  .max(maxAmountCents, { error: 'amount_out_of_range' })
  .optional()

export const operationListQuerySchema = z
  .object({
    page: z.coerce
      .number({ error: 'invalid' })
      .int({ error: 'invalid' })
      .min(1, { error: 'invalid' })
      .default(1),
    pageSize: z.coerce
      .number({ error: 'invalid' })
      .pipe(z.union(operationPageSizes.map((size) => z.literal(size))))
      .default(50),
    sort: operationSortFieldSchema.default('date'),
    order: sortOrderSchema.default('desc'),
    q: z
      .string({ error: 'invalid' })
      .trim()
      .max(100, { error: 'too_long' })
      .optional(),
    from: isoDateSchema.optional(),
    to: isoDateSchema.optional(),
    accountIds: asList(z.uuid({ error: 'invalid' })),
    groups: asList(operationGroupSchema),
    categoryIds: asList(z.uuid({ error: 'invalid' })),
    minCents: centsQuerySchema,
    maxCents: centsQuerySchema,
    direction: operationDirectionSchema.optional(),
    origins: asList(transactionOriginSchema),
    status: transactionStatusSchema.optional(),
  })
  .meta({ id: 'OperationListQuery' })

export const operationListResponseSchema = z
  .object({
    items: z.array(operationSchema),
    total: z.number().int(),
    page: z.number().int(),
    pageSize: z.number().int(),
  })
  .meta({ id: 'OperationListResponse' })
