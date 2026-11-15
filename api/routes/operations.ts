import { z } from 'zod'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  createOperationRequestSchema,
  createTransferRequestSchema,
  operationListQuerySchema,
  operationListResponseSchema,
  operationSchema,
  transferSchema,
  updateOperationRequestSchema,
  updateTransferRequestSchema,
} from '@mint/shared/schemas/operations'
import { defineUserRoute } from '../http/route.js'
import { toIssues, validationFailed } from '../http/http-error.js'
import { listOperations } from '../operations/list.js'
import {
  createTransferMovements,
  deleteOperationRows,
  ensureNotTransfer,
  findTransferMovements,
  findUserOperation,
  operationFieldsOf,
  parseOperationFields,
  statusFor,
  syncExecutedOccurrence,
  toOperation,
  toTransfer,
  transferFieldsOf,
  validateOperationReferences,
  validateTransferAccounts,
} from '../operations/operations.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'

const tag = 'operations'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse(
    'Unknown operation, transfer, account, payment method or category',
  ),
}

const referenceConflicts = errorResponse(
  'Archived account, payment method or category newly referenced',
)

const transferParamsSchema = z.object({ id: z.uuid() })

export const listOperationsRoute = defineUserRoute({
  method: 'get',
  path: '/operations',
  summary:
    'List the operations with pagination, sorting, full-text search and combinable filters (OPE-05)',
  tag,
  body: noBody,
  params: noParams,
  query: operationListQuerySchema,
  responses: {
    200: {
      description: 'One page of operations',
      schema: operationListResponseSchema,
    },
    400: errorResponse('Invalid query'),
    ...accessErrors,
  },
  handle: async ({ app, user, query }) => ({
    status: 200,
    body: await listOperations(app, user.id, query),
  }),
})

export const createOperationRoute = defineUserRoute({
  method: 'post',
  path: '/operations',
  summary:
    'Record an expense or an income on an account, optionally through one of its payment methods (OPE-01)',
  tag,
  body: createOperationRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Operation recorded', schema: operationSchema },
    400: errorResponse(
      'Invalid body, date before the initial balance, payment method of another account or adjustment category',
    ),
    ...resourceErrors,
    409: referenceConflicts,
  },
  handle: async ({ app, user, body }) => {
    await validateOperationReferences(app, user.id, body, null)
    const row = await app.models.Transaction.create({
      ...body,
      userId: user.id,
      status: statusFor(body.categoryId),
      origin: 'manual',
    })
    return { status: 201, body: await toOperation(app, row) }
  },
})

export const updateOperationRoute = defineUserRoute({
  method: 'patch',
  path: '/operations/:id',
  summary:
    'Modify an expense or an income, generated ones included (OPE-06, EXE-04)',
  tag,
  body: updateOperationRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Operation modified', schema: operationSchema },
    400: errorResponse(
      'Invalid body, date before the initial balance, payment method of another account or adjustment category',
    ),
    ...resourceErrors,
    409: errorResponse(
      'Movement of a transfer, or archived reference newly used',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const row = await app.sequelize.transaction(async (transaction) => {
      const found = await findUserOperation(
        app,
        user.id,
        params.id,
        transaction,
      )
      ensureNotTransfer(found)
      const fields = parseOperationFields({
        ...operationFieldsOf(found),
        ...body,
      })
      await validateOperationReferences(
        app,
        user.id,
        fields,
        found,
        transaction,
      )
      await found.update(
        { ...fields, status: statusFor(fields.categoryId) },
        { transaction },
      )
      await syncExecutedOccurrence(app, found, transaction)
      return found
    })
    return { status: 200, body: await toOperation(app, row) }
  },
})

export const deleteOperationRoute = defineUserRoute({
  method: 'delete',
  path: '/operations/:id',
  summary:
    'Delete an operation, both movements of a transfer; a generated one marks its occurrence as skipped (OPE-06, EXE-04)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Operation deleted' },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    await app.sequelize.transaction(async (transaction) => {
      const row = await findUserOperation(app, user.id, params.id, transaction)
      await deleteOperationRows(app, user.id, row, transaction)
    })
    return { status: 204 }
  },
})

export const createTransferRoute = defineUserRoute({
  method: 'post',
  path: '/transfers',
  summary:
    'Record an internal transfer: a debit of the source and a credit of the target, linked and without category (OPE-02)',
  tag,
  body: createTransferRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Transfer recorded', schema: transferSchema },
    400: errorResponse(
      'Invalid body, same account or date before an initial balance',
    ),
    ...resourceErrors,
    409: errorResponse('Archived account'),
  },
  handle: async ({ app, user, body }) => {
    const movements = await app.sequelize.transaction(async (transaction) => {
      await validateTransferAccounts(app, user.id, body, null, transaction)
      return createTransferMovements(app, user.id, body, transaction)
    })
    return { status: 201, body: await toTransfer(app, movements) }
  },
})

export const updateTransferRoute = defineUserRoute({
  method: 'patch',
  path: '/transfers/:id',
  summary:
    'Modify both movements of a transfer, identified by its transfer group (OPE-02)',
  tag,
  body: updateTransferRequestSchema,
  params: transferParamsSchema,
  responses: {
    200: { description: 'Transfer modified', schema: transferSchema },
    400: errorResponse(
      'Invalid body, same account or date before an initial balance',
    ),
    ...resourceErrors,
    409: errorResponse('Archived account newly referenced'),
  },
  handle: async ({ app, user, params, body }) => {
    const movements = await app.sequelize.transaction(async (transaction) => {
      const found = await findTransferMovements(
        app,
        user.id,
        params.id,
        transaction,
      )
      const parsed = createTransferRequestSchema.safeParse({
        ...transferFieldsOf(found),
        ...body,
      })
      if (!parsed.success) {
        throw validationFailed(toIssues(parsed.error))
      }
      const fields = parsed.data
      await validateTransferAccounts(app, user.id, fields, found, transaction)
      const common = {
        date: fields.date,
        label: fields.label,
        note: fields.note,
      }
      await found.source.update(
        {
          ...common,
          accountId: fields.sourceAccountId,
          amountCents: -fields.amountCents,
        },
        { transaction },
      )
      await found.target.update(
        {
          ...common,
          accountId: fields.targetAccountId,
          amountCents: fields.amountCents,
        },
        { transaction },
      )
      await syncExecutedOccurrence(app, found.target, transaction)
      return found
    })
    return { status: 200, body: await toTransfer(app, movements) }
  },
})
