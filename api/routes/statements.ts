import { UniqueConstraintError } from 'sequelize'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  createStatementRequestSchema,
  statementListResponseSchema,
  statementSchema,
} from '@mint/shared/schemas/statements'
import { findUserAccount } from '../accounts/accounts.js'
import {
  adjustmentCategoryId,
  ensureGap,
  findUserStatement,
  listStatements,
  statementById,
} from '../accounts/statements.js'
import { parisDate } from '../clock.js'
import { conflict, validationFailed } from '../http/http-error.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody } from '../schemas/http.js'

const tag = 'statements'

const accessErrors = { 401: errorResponse('No valid session') }

const adjustmentLabels = { fr: 'Ajustement', en: 'Adjustment' } as const

export const listStatementsRoute = defineUserRoute({
  method: 'get',
  path: '/accounts/:id/statements',
  summary:
    'Statement balances of an account, latest first, with the calculated balance at the end of their date and the gap (CPT-05)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Statements', schema: statementListResponseSchema },
    ...accessErrors,
    404: errorResponse('Unknown account'),
  },
  handle: async ({ app, user, params }) => {
    const account = await findUserAccount(app, user.id, params.id)
    return {
      status: 200,
      body: { statements: await listStatements(app, user.id, account.id) },
    }
  },
})

export const createStatementRoute = defineUserRoute({
  method: 'post',
  path: '/accounts/:id/statements',
  summary:
    'Record the balance read on a bank statement at a date and show its gap with the calculated balance (CPT-05)',
  tag,
  body: createStatementRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    201: { description: 'Statement recorded', schema: statementSchema },
    400: errorResponse(
      'Invalid body, date in the future or before the initial balance',
    ),
    ...accessErrors,
    404: errorResponse('Unknown account'),
    409: errorResponse('Archived account or statement already at this date'),
  },
  handle: async ({ app, user, params, body }) => {
    const account = await findUserAccount(app, user.id, params.id)
    if (account.archivedAt !== null) {
      throw conflict('account_archived')
    }
    if (body.date > parisDate(app.clock.now())) {
      throw validationFailed([{ path: ['date'], message: 'date_in_future' }])
    }
    if (body.date < account.initialBalanceDate) {
      throw validationFailed([
        { path: ['date'], message: 'date_before_initial_balance' },
      ])
    }
    try {
      const statement = await app.models.AccountStatement.create({
        userId: user.id,
        accountId: account.id,
        date: body.date,
        balanceCents: body.balanceCents,
      })
      return {
        status: 201,
        body: await statementById(app, user.id, statement.id),
      }
    } catch (error) {
      if (error instanceof UniqueConstraintError) {
        throw conflict('statement_exists')
      }
      throw error
    }
  },
})

export const adjustStatementRoute = defineUserRoute({
  method: 'post',
  path: '/statements/:id/adjust',
  summary:
    'Correct the gap of a statement with an operation of the system category Adjustment dated on the statement, excluded from every breakdown (CPT-05, CAT-08)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Gap corrected', schema: statementSchema },
    ...accessErrors,
    404: errorResponse('Unknown statement'),
    409: errorResponse('Archived account or no gap to correct'),
  },
  handle: async ({ app, user, params }) => {
    const statement = await app.sequelize.transaction(async (transaction) => {
      const row = await findUserStatement(app, user.id, params.id, transaction)
      const account = await findUserAccount(
        app,
        user.id,
        row.accountId,
        transaction,
      )
      if (account.archivedAt !== null) {
        throw conflict('account_archived')
      }
      const current = await statementById(app, user.id, row.id, transaction)
      ensureGap(current)
      const adjustment = await app.models.Transaction.create(
        {
          userId: user.id,
          accountId: account.id,
          date: row.date,
          amountCents: current.gapCents,
          label: adjustmentLabels[user.locale],
          categoryId: await adjustmentCategoryId(app, user.id, transaction),
          status: 'categorized',
          origin: 'manual',
        },
        { transaction },
      )
      await row.update(
        { adjustmentTransactionId: adjustment.id },
        { transaction },
      )
      return statementById(app, user.id, row.id, transaction)
    })
    return { status: 200, body: statement }
  },
})

export const deleteStatementRoute = defineUserRoute({
  method: 'delete',
  path: '/statements/:id',
  summary: 'Delete a statement; its adjustment operation, if any, stays',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Statement deleted' },
    ...accessErrors,
    404: errorResponse('Unknown statement'),
  },
  handle: async ({ app, user, params }) => {
    const statement = await findUserStatement(app, user.id, params.id)
    await statement.destroy()
    return { status: 204 }
  },
})
