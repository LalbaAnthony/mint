import { z } from 'zod'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  importBatchSchema,
  importBatchViewSchema,
  importFileMaxBytes,
  importFileQuerySchema,
  importHistorySchema,
  importMediaTypes,
  previewImportRequestSchema,
  validateImportRequestSchema,
} from '@mint/shared/schemas/imports'
import { findUserAccount } from '../accounts/accounts.js'
import { conflict } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import {
  batchView,
  cancelBatch,
  createBatch,
  findUserBatch,
  previewBatch,
  toImportBatch,
  validateBatch,
} from '../imports/imports.js'
import { errorResponse, noBody } from '../schemas/http.js'

const tag = 'imports'

const accessErrors = { 401: errorResponse('No valid session') }

const batchErrors = {
  ...accessErrors,
  404: errorResponse('Unknown import'),
}

const csvBodySchema = z.custom<Buffer>((value) => Buffer.isBuffer(value), {
  error: 'required',
})

export const createImportRoute = defineUserRoute({
  method: 'post',
  path: '/accounts/:id/imports',
  summary:
    'Upload a CSV file of at most 5 MB into an account; the pending import keeps the file and returns the remembered or guessed settings with the first lines (IMP-01 to IMP-03)',
  tag,
  body: csvBodySchema,
  requestBody: {
    format: 'binary',
    limit: importFileMaxBytes,
    mediaTypes: importMediaTypes,
  },
  params: resourceIdParamsSchema,
  query: importFileQuerySchema,
  responses: {
    201: { description: 'Pending import', schema: importBatchViewSchema },
    400: errorResponse('Missing or empty file, or missing file name'),
    ...accessErrors,
    404: errorResponse('Unknown account'),
    409: errorResponse('Archived account'),
    413: errorResponse('File larger than 5 MB'),
  },
  handle: async ({ app, user, params, query, body }) => {
    const batch = await createBatch(
      app,
      user.id,
      params.id,
      query.filename,
      body,
    )
    return { status: 201, body: await batchView(app, batch) }
  },
})

export const importHistoryRoute = defineUserRoute({
  method: 'get',
  path: '/accounts/:id/imports',
  summary:
    'Imports of an account, latest first, with their read, created, duplicate and merged lines (IMP-08)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Import history', schema: importHistorySchema },
    ...accessErrors,
    404: errorResponse('Unknown account'),
  },
  handle: async ({ app, user, params }) => {
    const account = await findUserAccount(app, user.id, params.id)
    const batches = await app.models.ImportBatch.findAll({
      where: { userId: user.id, accountId: account.id },
      order: [['createdAt', 'DESC']],
    })
    return { status: 200, body: { batches: batches.map(toImportBatch) } }
  },
})

export const getImportRoute = defineUserRoute({
  method: 'get',
  path: '/imports/:id',
  summary: 'An import with its settings, first lines and interpreted lines',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Import', schema: importBatchViewSchema },
    ...batchErrors,
  },
  handle: async ({ app, user, params }) => {
    const batch = await findUserBatch(app, user.id, params.id)
    return { status: 200, body: await batchView(app, batch) }
  },
})

export const previewImportRoute = defineUserRoute({
  method: 'post',
  path: '/imports/:id/preview',
  summary:
    'Read the file with the given settings: interpreted lines, lines in error with their reason, strict duplicates, matching rules and reconciliation proposals, nothing recorded yet (IMP-02, IMP-04 to IMP-06, RAP-01, RAP-02)',
  tag,
  body: previewImportRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Previewed import', schema: importBatchViewSchema },
    400: errorResponse('Invalid settings'),
    ...batchErrors,
    409: errorResponse('Import already validated or cancelled'),
  },
  handle: async ({ app, user, params, body }) => {
    const batch = await findUserBatch(app, user.id, params.id)
    await previewBatch(app, user.id, batch, body.mapping)
    return { status: 200, body: await batchView(app, batch, body.mapping) }
  },
})

export const validateImportRoute = defineUserRoute({
  method: 'post',
  path: '/imports/:id/validate',
  summary:
    'Record the previewed lines with their categories, transfers and confirmed reconciliations, remember the settings of the account and drop the file (IMP-03, IMP-07, RAP-03, RAP-04, RAP-06, RAP-07)',
  tag,
  body: validateImportRequestSchema,
  requestBody: { format: 'json', limit: '4mb' },
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Validated import', schema: importBatchSchema },
    400: errorResponse('Invalid decisions'),
    ...batchErrors,
    409: errorResponse(
      'Import not pending or not previewed, archived reference, or occurrence no longer a candidate',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const batch = await findUserBatch(app, user.id, params.id)
    await validateBatch(app, user.id, batch, body, app.clock.now())
    return { status: 200, body: toImportBatch(batch) }
  },
})

export const abandonImportRoute = defineUserRoute({
  method: 'delete',
  path: '/imports/:id',
  summary: 'Abandon a pending import and its file',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Import abandoned' },
    ...batchErrors,
    409: errorResponse('Import already validated or cancelled'),
  },
  handle: async ({ app, user, params }) => {
    const batch = await findUserBatch(app, user.id, params.id)
    if (batch.status !== 'pending') {
      throw conflict('import_not_pending')
    }
    await batch.destroy()
    return { status: 204 }
  },
})

export const cancelImportRoute = defineUserRoute({
  method: 'post',
  path: '/imports/:id/cancel',
  summary:
    'Cancel a validated import: delete the operations it created and restore the operations it merged (IMP-08)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Cancelled import', schema: importBatchSchema },
    ...batchErrors,
    409: errorResponse('Import not validated'),
  },
  handle: async ({ app, user, params }) => {
    const batch = await findUserBatch(app, user.id, params.id)
    await cancelBatch(app, batch, app.clock.now())
    return { status: 200, body: toImportBatch(batch) }
  },
})
