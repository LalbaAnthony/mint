import { monthStart } from '@mint/shared/engines/dates'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  createEnvelopeRequestSchema,
  envelopeMonthAmountRequestSchema,
  envelopeMonthOverrideSchema,
  envelopeMonthParamsSchema,
  envelopeMonthQuerySchema,
  envelopeMonthResponseSchema,
  envelopeSchema,
  updateEnvelopeRequestSchema,
} from '@mint/shared/schemas/envelopes'
import { parisDate } from '../clock.js'
import {
  envelopeFieldsOf,
  envelopeMonth,
  envelopeView,
  findUserEnvelope,
  parseEnvelopeFields,
  removeEnvelopeMonthAmount,
  replaceEnvelopeCategories,
  setEnvelopeMonthAmount,
  validateEnvelopeReferences,
} from '../envelopes/envelopes.js'
import { defineUserRoute } from '../http/route.js'
import { loadEnvelopeCategoryIds } from '../planning/inputs.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'

const tag = 'envelopes'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse('Unknown envelope, account, payment method or category'),
}

const referenceConflicts = errorResponse(
  'Archived account, payment method or category newly referenced, or category already in another envelope',
)

export const envelopeMonthRoute = defineUserRoute({
  method: 'get',
  path: '/envelopes',
  summary:
    'Budget, carry-over, consumption and availability of each active envelope for one month, the current one by default, with their totals (ENV-03 to ENV-08)',
  tag,
  body: noBody,
  params: noParams,
  query: envelopeMonthQuerySchema,
  responses: {
    200: {
      description: 'Envelopes of the month',
      schema: envelopeMonthResponseSchema,
    },
    400: errorResponse('Invalid month'),
    ...accessErrors,
  },
  handle: async ({ app, user, query }) => {
    const today = parisDate(app.clock.now())
    return {
      status: 200,
      body: await envelopeMonth(
        app,
        user.id,
        query.month ?? monthStart(today),
        today,
      ),
    }
  },
})

export const createEnvelopeRoute = defineUserRoute({
  method: 'post',
  path: '/envelopes',
  summary:
    'Create an envelope on expense categories, debited on a default account or payment method (ENV-01)',
  tag,
  body: createEnvelopeRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Envelope created', schema: envelopeSchema },
    400: errorResponse('Invalid body or category that is not an expense one'),
    ...resourceErrors,
    409: referenceConflicts,
  },
  handle: async ({ app, user, body }) => {
    const envelope = await app.sequelize.transaction(async (transaction) => {
      await validateEnvelopeReferences(app, user.id, body, null, transaction)
      const created = await app.models.Envelope.create(
        {
          userId: user.id,
          label: body.label,
          monthlyAmountCents: body.monthlyAmountCents,
          accountId: body.accountId,
          paymentMethodId: body.paymentMethodId,
          carryOver: body.carryOver,
          active: body.active,
          createdOn: parisDate(app.clock.now()),
        },
        { transaction },
      )
      await replaceEnvelopeCategories(
        app,
        user.id,
        created.id,
        body.categoryIds,
        transaction,
      )
      return envelopeView(app, created, transaction)
    })
    return { status: 201, body: envelope }
  },
})

export const updateEnvelopeRoute = defineUserRoute({
  method: 'patch',
  path: '/envelopes/:id',
  summary: 'Modify an envelope, its categories included',
  tag,
  body: updateEnvelopeRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Envelope modified', schema: envelopeSchema },
    400: errorResponse('Invalid body or category that is not an expense one'),
    ...resourceErrors,
    409: referenceConflicts,
  },
  handle: async ({ app, user, params, body }) => {
    const envelope = await app.sequelize.transaction(async (transaction) => {
      const found = await findUserEnvelope(app, user.id, params.id, transaction)
      const currentIds =
        (await loadEnvelopeCategoryIds(app, [found.id], transaction)).get(
          found.id,
        ) ?? []
      const fields = parseEnvelopeFields({
        ...envelopeFieldsOf(found, currentIds),
        ...body,
      })
      await validateEnvelopeReferences(
        app,
        user.id,
        fields,
        { envelope: found, categoryIds: currentIds },
        transaction,
      )
      await found.update(
        {
          label: fields.label,
          monthlyAmountCents: fields.monthlyAmountCents,
          accountId: fields.accountId,
          paymentMethodId: fields.paymentMethodId,
          carryOver: fields.carryOver,
          active: fields.active,
        },
        { transaction },
      )
      await replaceEnvelopeCategories(
        app,
        user.id,
        found.id,
        fields.categoryIds,
        transaction,
      )
      return envelopeView(app, found, transaction)
    })
    return { status: 200, body: envelope }
  },
})

export const deleteEnvelopeRoute = defineUserRoute({
  method: 'delete',
  path: '/envelopes/:id',
  summary: 'Delete an envelope and its category memberships',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Envelope deleted' },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    const envelope = await findUserEnvelope(app, user.id, params.id)
    await envelope.destroy()
    return { status: 204 }
  },
})

export const setEnvelopeMonthAmountRoute = defineUserRoute({
  method: 'post',
  path: '/envelopes/:id/months/:month',
  summary:
    'Set the amount of an envelope for one month, possibly zero, without changing its monthly amount (ENV-07)',
  tag,
  body: envelopeMonthAmountRequestSchema,
  params: envelopeMonthParamsSchema,
  responses: {
    200: {
      description: 'Amount of the month set',
      schema: envelopeMonthOverrideSchema,
    },
    400: errorResponse('Invalid amount'),
    ...accessErrors,
    404: errorResponse('Unknown envelope, or month not the first day of one'),
  },
  handle: async ({ app, user, params, body }) => ({
    status: 200,
    body: await setEnvelopeMonthAmount(
      app,
      user.id,
      params.id,
      params.month,
      body.amountCents,
    ),
  }),
})

export const removeEnvelopeMonthAmountRoute = defineUserRoute({
  method: 'delete',
  path: '/envelopes/:id/months/:month',
  summary:
    'Remove the amount of an envelope for one month, which goes back to its monthly amount (ENV-07)',
  tag,
  body: noBody,
  params: envelopeMonthParamsSchema,
  responses: {
    204: { description: 'Monthly amount restored' },
    ...accessErrors,
    404: errorResponse('Unknown envelope, or month not the first day of one'),
  },
  handle: async ({ app, user, params }) => {
    await removeEnvelopeMonthAmount(app, user.id, params.id, params.month)
    return { status: 204 }
  },
})
