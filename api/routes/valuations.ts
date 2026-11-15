import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  createValuationRequestSchema,
  updateValuationRequestSchema,
  valuationListResponseSchema,
  valuationSchema,
} from '@mint/shared/schemas/valuations'
import { findUserAccount } from '../accounts/accounts.js'
import {
  ensureInvestment,
  ensureValuationDate,
  ensureWritable,
  findInvestmentAccount,
  findUserValuation,
  toValuation,
  valuationList,
  withUniqueValuationDate,
} from '../accounts/valuations.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody } from '../schemas/http.js'

const tag = 'valuations'

const accessErrors = { 401: errorResponse('No valid session') }

export const listValuationsRoute = defineUserRoute({
  method: 'get',
  path: '/accounts/:id/valuations',
  summary:
    'Valuations of an investment account, latest first, with the amount paid in, the reference balance and the latent gain (CPT-06)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Valuations', schema: valuationListResponseSchema },
    ...accessErrors,
    404: errorResponse('Unknown account'),
    409: errorResponse('Account of a non-investment nature'),
  },
  handle: async ({ app, user, params }) => {
    const account = await findInvestmentAccount(app, user.id, params.id)
    return { status: 200, body: await valuationList(app, account) }
  },
})

export const createValuationRoute = defineUserRoute({
  method: 'post',
  path: '/accounts/:id/valuations',
  summary:
    'Record the market value of an investment account at a date, from its initial balance date to today (CPT-06)',
  tag,
  body: createValuationRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    201: { description: 'Valuation recorded', schema: valuationSchema },
    400: errorResponse(
      'Invalid body, date in the future or before the initial balance',
    ),
    ...accessErrors,
    404: errorResponse('Unknown account'),
    409: errorResponse(
      'Archived or non-investment account, or valuation already at this date',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const account = await findInvestmentAccount(app, user.id, params.id)
    ensureWritable(account)
    ensureValuationDate(app, account, body.date)
    const valuation = await withUniqueValuationDate(() =>
      app.models.Valuation.create({
        userId: user.id,
        accountId: account.id,
        date: body.date,
        valueCents: body.valueCents,
      }),
    )
    return { status: 201, body: toValuation(valuation) }
  },
})

export const updateValuationRoute = defineUserRoute({
  method: 'patch',
  path: '/valuations/:id',
  summary: 'Modify the date or the value of a valuation (CPT-06)',
  tag,
  body: updateValuationRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Valuation modified', schema: valuationSchema },
    400: errorResponse(
      'Invalid body, date in the future or before the initial balance',
    ),
    ...accessErrors,
    404: errorResponse('Unknown valuation'),
    409: errorResponse('Archived account or valuation already at this date'),
  },
  handle: async ({ app, user, params, body }) => {
    const valuation = await findUserValuation(app, user.id, params.id)
    const account = await findUserAccount(app, user.id, valuation.accountId)
    ensureInvestment(account)
    ensureWritable(account)
    const date = body.date ?? valuation.date
    ensureValuationDate(app, account, date)
    await withUniqueValuationDate(() =>
      valuation.update({
        date,
        valueCents: body.valueCents ?? valuation.valueCents,
      }),
    )
    return { status: 200, body: toValuation(valuation) }
  },
})

export const deleteValuationRoute = defineUserRoute({
  method: 'delete',
  path: '/valuations/:id',
  summary: 'Delete a valuation (CPT-06)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Valuation deleted' },
    ...accessErrors,
    404: errorResponse('Unknown valuation'),
    409: errorResponse('Archived account'),
  },
  handle: async ({ app, user, params }) => {
    const valuation = await findUserValuation(app, user.id, params.id)
    const account = await findUserAccount(app, user.id, valuation.accountId)
    ensureWritable(account)
    await valuation.destroy()
    return { status: 204 }
  },
})
