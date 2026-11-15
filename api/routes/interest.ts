import { UniqueConstraintError } from 'sequelize'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  isSavingsNature,
  regulatedCapListResponseSchema,
  regulatedCapParamsSchema,
  regulatedCapSchema,
  regulatedProducts,
  updateRegulatedCapRequestSchema,
} from '@mint/shared/schemas/accounts'
import {
  createInterestRateRequestSchema,
  interestRateSchema,
  interestResponseSchema,
} from '@mint/shared/schemas/interest'
import type { InterestRate } from '@mint/shared/types/interest'
import { findUserAccount } from '../accounts/accounts.js'
import { loadSavingsSummaries } from '../accounts/savings.js'
import { audit } from '../audit.js'
import { parisDate } from '../clock.js'
import { conflict, notFound } from '../http/http-error.js'
import { defineAdminRoute, defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import type { AccountModel, InterestRateModel } from '../types/models.js'

const tag = 'interest'

const accessErrors = { 401: errorResponse('No valid session') }

function toInterestRate(rate: InterestRateModel): InterestRate {
  return {
    id: rate.id,
    accountId: rate.accountId,
    effectiveDate: rate.effectiveDate,
    annualRatePct: rate.annualRate,
  }
}

function ensureSavings(account: AccountModel): void {
  if (!isSavingsNature(account.nature)) {
    throw conflict('account_not_savings')
  }
}

function ensureWritable(account: AccountModel): void {
  if (account.archivedAt !== null) {
    throw conflict('account_archived')
  }
}

export const getInterestRoute = defineUserRoute({
  method: 'get',
  path: '/accounts/:id/interest',
  summary:
    'Rate history of a regulated or housing savings account, latest first, with the interest acquired since the last capitalization and the amount projected at the next one (LIV-03, LIV-04)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Rates and interest', schema: interestResponseSchema },
    ...accessErrors,
    404: errorResponse('Unknown account'),
    409: errorResponse('Account of another nature'),
  },
  handle: async ({ app, user, params }) => {
    const account = await findUserAccount(app, user.id, params.id)
    ensureSavings(account)
    const rates = await app.models.InterestRate.findAll({
      where: { userId: user.id, accountId: account.id },
      order: [['effectiveDate', 'DESC']],
    })
    const summary = (
      await loadSavingsSummaries(
        app,
        user.id,
        [account],
        parisDate(app.clock.now()),
      )
    ).get(account.id)?.interest
    if (summary === undefined || summary === null) {
      throw conflict('account_not_savings')
    }
    return {
      status: 200,
      body: { rates: rates.map(toInterestRate), summary },
    }
  },
})

export const createInterestRateRoute = defineUserRoute({
  method: 'post',
  path: '/accounts/:id/interest-rates',
  summary:
    'Record the annual rate of a savings account from an effective date (LIV-03)',
  tag,
  body: createInterestRateRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    201: { description: 'Rate recorded', schema: interestRateSchema },
    400: errorResponse('Invalid body'),
    ...accessErrors,
    404: errorResponse('Unknown account'),
    409: errorResponse(
      'Account of another nature, archived, or rate already at this date',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const account = await findUserAccount(app, user.id, params.id)
    ensureSavings(account)
    ensureWritable(account)
    try {
      const rate = await app.models.InterestRate.create({
        userId: user.id,
        accountId: account.id,
        effectiveDate: body.effectiveDate,
        annualRate: body.annualRatePct,
      })
      return { status: 201, body: toInterestRate(rate) }
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw conflict('interest_rate_exists')
      }
      throw error
    }
  },
})

export const deleteInterestRateRoute = defineUserRoute({
  method: 'delete',
  path: '/interest-rates/:id',
  summary: 'Delete a rate of the history (LIV-03)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Rate deleted' },
    ...accessErrors,
    404: errorResponse('Unknown rate'),
    409: errorResponse('Archived account'),
  },
  handle: async ({ app, user, params }) => {
    const rate = await app.models.InterestRate.findOne({
      where: { id: params.id, userId: user.id },
    })
    if (rate === null) {
      throw notFound()
    }
    ensureWritable(await findUserAccount(app, user.id, rate.accountId))
    await rate.destroy()
    return { status: 204 }
  },
})

export const listRegulatedCapsRoute = defineUserRoute({
  method: 'get',
  path: '/regulated-caps',
  summary:
    'Reference deposit caps of the regulated products, used to prefill the cap of an account (LIV-01)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: {
      description: 'Reference caps',
      schema: regulatedCapListResponseSchema,
    },
    ...accessErrors,
  },
  handle: async ({ app }) => {
    const caps = await app.models.RegulatedCap.findAll()
    return {
      status: 200,
      body: regulatedProducts.flatMap((product) => {
        const cap = caps.find((candidate) => candidate.product === product)
        return cap === undefined ? [] : [{ product, capCents: cap.capCents }]
      }),
    }
  },
})

export const updateRegulatedCapRoute = defineAdminRoute({
  method: 'patch',
  path: '/admin/regulated-caps/:product',
  summary:
    'Change the reference deposit cap of a regulated product; existing accounts keep their own cap (LIV-01)',
  tag,
  body: updateRegulatedCapRequestSchema,
  params: regulatedCapParamsSchema,
  responses: {
    200: { description: 'Reference cap changed', schema: regulatedCapSchema },
    400: errorResponse('Invalid body'),
    ...accessErrors,
    403: errorResponse('Not an administrator'),
    404: errorResponse('Unknown product'),
  },
  handle: async ({ app, user, params, body }) => {
    const cap = await app.models.RegulatedCap.findOne({
      where: { product: params.product },
    })
    if (cap === null) {
      throw notFound()
    }
    await cap.update({ capCents: body.capCents, updatedBy: user.id })
    audit('regulated_cap_updated', {
      adminId: user.id,
      product: params.product,
    })
    return {
      status: 200,
      body: { product: params.product, capCents: cap.capCents },
    }
  },
})
