import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  createPaymentMethodRequestSchema,
  paymentMethodListResponseSchema,
  paymentMethodSchema,
  updatePaymentMethodRequestSchema,
} from '@mint/shared/schemas/payment-methods'
import { conflict } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import {
  findActiveAccount,
  findUserPaymentMethod,
  toPaymentMethod,
} from '../payment-methods/payment-methods.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'

const tag = 'payment-methods'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse('Unknown payment method or account'),
}

export const listPaymentMethodsRoute = defineUserRoute({
  method: 'get',
  path: '/payment-methods',
  summary: 'List every payment method, archived ones included (PAY-05)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'Payment methods',
      schema: paymentMethodListResponseSchema,
    },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    const paymentMethods = await app.models.PaymentMethod.findAll({
      where: { userId: user.id },
      order: [
        ['createdAt', 'ASC'],
        ['id', 'ASC'],
      ],
    })
    return { status: 200, body: paymentMethods.map(toPaymentMethod) }
  },
})

export const createPaymentMethodRoute = defineUserRoute({
  method: 'post',
  path: '/payment-methods',
  summary: 'Create a payment method on an active account (PAY-01)',
  tag,
  body: createPaymentMethodRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Payment method created', schema: paymentMethodSchema },
    400: errorResponse('Invalid request body'),
    ...resourceErrors,
    409: errorResponse('Archived account'),
  },
  handle: async ({ app, user, body }) => {
    const account = await findActiveAccount(app, user.id, body.accountId)
    const paymentMethod = await app.models.PaymentMethod.create({
      userId: user.id,
      accountId: account.id,
      label: body.label,
      kind: body.kind,
    })
    return { status: 201, body: toPaymentMethod(paymentMethod) }
  },
})

export const updatePaymentMethodRoute = defineUserRoute({
  method: 'patch',
  path: '/payment-methods/:id',
  summary: 'Modify an active payment method',
  tag,
  body: updatePaymentMethodRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: {
      description: 'Payment method modified',
      schema: paymentMethodSchema,
    },
    400: errorResponse('Invalid request body'),
    ...resourceErrors,
    409: errorResponse('Archived payment method or archived target account'),
  },
  handle: async ({ app, user, params, body }) => {
    const paymentMethod = await findUserPaymentMethod(app, user.id, params.id)
    if (paymentMethod.archivedAt !== null) {
      throw conflict('archived')
    }
    if (
      body.accountId !== undefined &&
      body.accountId !== paymentMethod.accountId
    ) {
      await findActiveAccount(app, user.id, body.accountId)
    }
    await paymentMethod.update(body)
    return { status: 200, body: toPaymentMethod(paymentMethod) }
  },
})

export const archivePaymentMethodRoute = defineUserRoute({
  method: 'post',
  path: '/payment-methods/:id/archive',
  summary: 'Archive a payment method, no longer offered for input (PAY-05)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: {
      description: 'Payment method archived',
      schema: paymentMethodSchema,
    },
    ...resourceErrors,
    409: errorResponse('Payment method already archived'),
  },
  handle: async ({ app, user, params }) => {
    const paymentMethod = await findUserPaymentMethod(app, user.id, params.id)
    if (paymentMethod.archivedAt !== null) {
      throw conflict('archived')
    }
    await paymentMethod.update({ archivedAt: app.clock.now() })
    return { status: 200, body: toPaymentMethod(paymentMethod) }
  },
})

export const restorePaymentMethodRoute = defineUserRoute({
  method: 'post',
  path: '/payment-methods/:id/restore',
  summary: 'Restore an archived payment method whose account is active',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: {
      description: 'Payment method restored',
      schema: paymentMethodSchema,
    },
    ...resourceErrors,
    409: errorResponse('Payment method not archived, or archived account'),
  },
  handle: async ({ app, user, params }) => {
    const paymentMethod = await findUserPaymentMethod(app, user.id, params.id)
    if (paymentMethod.archivedAt === null) {
      throw conflict('not_archived')
    }
    await findActiveAccount(app, user.id, paymentMethod.accountId)
    await paymentMethod.update({ archivedAt: null })
    return { status: 200, body: toPaymentMethod(paymentMethod) }
  },
})

export const deletePaymentMethodRoute = defineUserRoute({
  method: 'delete',
  path: '/payment-methods/:id',
  summary: 'Delete a payment method that nothing references',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Payment method deleted' },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    const paymentMethod = await findUserPaymentMethod(app, user.id, params.id)
    await paymentMethod.destroy()
    return { status: 204 }
  },
})
