import {
  accountOverviewSchema,
  accountSchema,
  createAccountRequestSchema,
  isInvestmentNature,
  reorderAccountsRequestSchema,
  updateAccountRequestSchema,
} from '@mint/shared/schemas/accounts'
import { Op } from 'sequelize'
import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import { usageCountsSchema } from '@mint/shared/schemas/usage'
import {
  accountFields,
  accountWithBalance,
  buildAccountOverview,
  findUserAccount,
  nextAccountSortOrder,
  toAccount,
  validateAccountFields,
} from '../accounts/accounts.js'
import { parisDate } from '../clock.js'
import { conflict } from '../http/http-error.js'
import { loadStatementGaps } from '../accounts/statements.js'
import { loadInvestmentSummaries } from '../accounts/investments.js'
import { accountUsage, loadAccountBalances } from '../planning/usage.js'
import { ensureSameMembers } from '../http/ordering.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'

const tag = 'accounts'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse('Unknown account'),
}

export const accountOverviewRoute = defineUserRoute({
  method: 'get',
  path: '/accounts/overview',
  summary:
    'Active accounts grouped by usage with subtotals and total, then archived accounts (CPT-08)',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Where my money is', schema: accountOverviewSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    const accounts = await app.models.Account.findAll({
      where: { userId: user.id },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    })
    const today = parisDate(app.clock.now())
    const balances = await loadAccountBalances(app, user.id, today)
    const gaps = await loadStatementGaps(app, user.id)
    const investments = await loadInvestmentSummaries(
      app,
      user.id,
      accounts,
      today,
    )
    return {
      status: 200,
      body: buildAccountOverview(
        accounts.map((account) =>
          toAccount(account, balances, gaps, investments),
        ),
      ),
    }
  },
})

export const createAccountRoute = defineUserRoute({
  method: 'post',
  path: '/accounts',
  summary: 'Create an account, placed last in its usage',
  tag,
  body: createAccountRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Account created', schema: accountSchema },
    400: errorResponse('Invalid body or initial balance dated in the future'),
    ...accessErrors,
  },
  handle: async ({ app, user, body }) => {
    const fields = validateAccountFields(app, body)
    const account = await app.sequelize.transaction(async (transaction) =>
      app.models.Account.create(
        {
          ...fields,
          userId: user.id,
          sortOrder: await nextAccountSortOrder(
            app,
            user.id,
            fields.usage,
            transaction,
          ),
        },
        { transaction },
      ),
    )
    return { status: 201, body: await accountWithBalance(app, account) }
  },
})

export const updateAccountRoute = defineUserRoute({
  method: 'patch',
  path: '/accounts/:id',
  summary: 'Modify an active account; a new usage places it last',
  tag,
  body: updateAccountRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Account modified', schema: accountSchema },
    400: errorResponse('Invalid body or initial balance dated in the future'),
    ...resourceErrors,
    409: errorResponse(
      'Archived account, operations dated before the new initial balance date, or valuations kept by a non-investment nature',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const account = await findUserAccount(app, user.id, params.id)
    if (account.archivedAt !== null) {
      throw conflict('archived')
    }
    const fields = validateAccountFields(app, {
      ...accountFields(account),
      ...body,
    })
    if (
      isInvestmentNature(account.nature) &&
      !isInvestmentNature(fields.nature)
    ) {
      const valuations = await app.models.Valuation.count({
        where: { userId: user.id, accountId: account.id },
      })
      if (valuations > 0) {
        throw conflict('account_has_valuations')
      }
    }
    if (fields.initialBalanceDate > account.initialBalanceDate) {
      const earlier = await app.models.Transaction.count({
        where: {
          userId: user.id,
          accountId: account.id,
          date: { [Op.lt]: fields.initialBalanceDate },
        },
      })
      if (earlier > 0) {
        throw conflict('operations_before_initial_balance')
      }
    }
    const sortOrder =
      fields.usage === account.usage
        ? account.sortOrder
        : await nextAccountSortOrder(app, user.id, fields.usage)
    await account.update({ ...fields, sortOrder })
    return { status: 200, body: await accountWithBalance(app, account) }
  },
})

export const archiveAccountRoute = defineUserRoute({
  method: 'post',
  path: '/accounts/:id/archive',
  summary: 'Archive an account and its active payment methods (CPT-07)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Account archived', schema: accountSchema },
    ...resourceErrors,
    409: errorResponse('Account already archived'),
  },
  handle: async ({ app, user, params }) => {
    const now = app.clock.now()
    const account = await app.sequelize.transaction(async (transaction) => {
      const found = await findUserAccount(app, user.id, params.id, transaction)
      if (found.archivedAt !== null) {
        throw conflict('archived')
      }
      await found.update({ archivedAt: now }, { transaction })
      await app.models.PaymentMethod.update(
        { archivedAt: now },
        {
          where: { userId: user.id, accountId: found.id, archivedAt: null },
          transaction,
        },
      )
      return found
    })
    return { status: 200, body: await accountWithBalance(app, account) }
  },
})

export const restoreAccountRoute = defineUserRoute({
  method: 'post',
  path: '/accounts/:id/restore',
  summary:
    'Restore an archived account, placed last in its usage; its payment methods stay archived',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Account restored', schema: accountSchema },
    ...resourceErrors,
    409: errorResponse('Account not archived'),
  },
  handle: async ({ app, user, params }) => {
    const account = await app.sequelize.transaction(async (transaction) => {
      const found = await findUserAccount(app, user.id, params.id, transaction)
      if (found.archivedAt === null) {
        throw conflict('not_archived')
      }
      await found.update(
        {
          archivedAt: null,
          sortOrder: await nextAccountSortOrder(
            app,
            user.id,
            found.usage,
            transaction,
          ),
        },
        { transaction },
      )
      return found
    })
    return { status: 200, body: await accountWithBalance(app, account) }
  },
})

export const accountUsageRoute = defineUserRoute({
  method: 'get',
  path: '/accounts/:id/usage',
  summary:
    'Count the operations, schedules and envelopes referencing an account or its payment methods',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Usage counts', schema: usageCountsSchema },
    ...resourceErrors,
  },
  handle: async ({ app, user, params }) => {
    const account = await findUserAccount(app, user.id, params.id)
    return { status: 200, body: await accountUsage(app, user.id, account.id) }
  },
})

export const deleteAccountRoute = defineUserRoute({
  method: 'delete',
  path: '/accounts/:id',
  summary:
    'Delete an account that no operation, schedule or envelope references, with its payment methods (CPT-07)',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Account and its payment methods deleted' },
    ...resourceErrors,
    409: errorResponse(
      'The account has operations, or schedules or envelopes reference it',
    ),
  },
  handle: async ({ app, user, params }) => {
    await app.sequelize.transaction(async (transaction) => {
      const account = await findUserAccount(
        app,
        user.id,
        params.id,
        transaction,
      )
      const usage = await accountUsage(app, user.id, account.id, transaction)
      if (usage.operations > 0) {
        throw conflict('account_has_operations')
      }
      if (usage.schedules + usage.envelopes + usage.rules > 0) {
        throw conflict('account_in_use')
      }
      await app.models.PaymentMethod.destroy({
        where: { userId: user.id, accountId: account.id },
        transaction,
      })
      await account.destroy({ transaction })
    })
    return { status: 204 }
  },
})

export const reorderAccountsRoute = defineUserRoute({
  method: 'post',
  path: '/accounts/reorder',
  summary: 'Set the display order of the active accounts of one usage (CPT-01)',
  tag,
  body: reorderAccountsRequestSchema,
  params: noParams,
  responses: {
    204: { description: 'Order saved' },
    400: errorResponse('Invalid request body'),
    ...accessErrors,
    409: errorResponse(
      'The list is not exactly the active accounts of this usage',
    ),
  },
  handle: async ({ app, user, body }) => {
    await app.sequelize.transaction(async (transaction) => {
      const accounts = await app.models.Account.findAll({
        where: { userId: user.id, usage: body.usage, archivedAt: null },
        transaction,
      })
      ensureSameMembers(
        accounts.map((account) => account.id),
        body.accountIds,
      )
      for (const [index, id] of body.accountIds.entries()) {
        await app.models.Account.update(
          { sortOrder: index },
          { where: { id, userId: user.id }, transaction },
        )
      }
    })
    return { status: 204 }
  },
})
