import { UniqueConstraintError } from 'sequelize'
import type { Transaction } from 'sequelize'
import { isInvestmentNature } from '@mint/shared/schemas/accounts'
import type {
  Valuation,
  ValuationListResponse,
} from '@mint/shared/types/valuations'
import { parisDate } from '../clock.js'
import { conflict, notFound, validationFailed } from '../http/http-error.js'
import type { AppDependencies } from '../types/app.js'
import type { AccountModel, ValuationModel } from '../types/models.js'
import { findUserAccount } from './accounts.js'
import { loadInvestmentSummaries } from './investments.js'

export function toValuation(valuation: ValuationModel): Valuation {
  return {
    id: valuation.id,
    accountId: valuation.accountId,
    date: valuation.date,
    valueCents: valuation.valueCents,
  }
}

export function ensureInvestment(account: AccountModel): void {
  if (!isInvestmentNature(account.nature)) {
    throw conflict('account_not_investment')
  }
}

export async function findInvestmentAccount(
  app: AppDependencies,
  userId: string,
  accountId: string,
  transaction?: Transaction,
): Promise<AccountModel> {
  const account = await findUserAccount(app, userId, accountId, transaction)
  ensureInvestment(account)
  return account
}

export function ensureWritable(account: AccountModel): void {
  if (account.archivedAt !== null) {
    throw conflict('account_archived')
  }
}

export function ensureValuationDate(
  app: AppDependencies,
  account: AccountModel,
  date: string,
): void {
  if (date > parisDate(app.clock.now())) {
    throw validationFailed([{ path: ['date'], message: 'date_in_future' }])
  }
  if (date < account.initialBalanceDate) {
    throw validationFailed([
      { path: ['date'], message: 'date_before_initial_balance' },
    ])
  }
}

export async function withUniqueValuationDate<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw conflict('valuation_exists')
    }
    throw error
  }
}

export async function findUserValuation(
  app: AppDependencies,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<ValuationModel> {
  const valuation = await app.models.Valuation.findOne({
    where: { id, userId },
    transaction,
  })
  if (valuation === null) {
    throw notFound()
  }
  return valuation
}

export async function valuationList(
  app: AppDependencies,
  account: AccountModel,
): Promise<ValuationListResponse> {
  const valuations = await app.models.Valuation.findAll({
    where: { userId: account.userId, accountId: account.id },
    order: [['date', 'DESC']],
  })
  const summary = (
    await loadInvestmentSummaries(
      app,
      account.userId,
      [account],
      parisDate(app.clock.now()),
    )
  ).get(account.id)
  if (summary === undefined) {
    throw new Error(`No investment summary for account ${account.id}`)
  }
  return { valuations: valuations.map(toValuation), summary }
}
