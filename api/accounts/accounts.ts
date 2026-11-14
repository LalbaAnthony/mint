import type { Transaction } from 'sequelize'
import {
  accountUsages,
  createAccountRequestSchema,
} from '@mint/shared/schemas/accounts'
import type {
  Account,
  AccountOverview,
  AccountUsage,
  CreateAccountRequest,
} from '@mint/shared/types/accounts'
import { parisDate } from '../clock.js'
import { notFound, toIssues, validationFailed } from '../http/http-error.js'
import type { AppDependencies } from '../types/app.js'
import type { AccountModel } from '../types/models.js'

export function currentBalanceCents(account: AccountModel): number {
  return account.initialBalanceCents
}

export function toAccount(account: AccountModel): Account {
  return {
    id: account.id,
    name: account.name,
    nature: account.nature,
    regulatedProduct: account.regulatedProduct,
    usage: account.usage,
    institution: account.institution,
    initialBalanceCents: account.initialBalanceCents,
    initialBalanceDate: account.initialBalanceDate,
    lowBalanceThresholdCents: account.lowBalanceThresholdCents,
    sortOrder: account.sortOrder,
    archivedAt: account.archivedAt?.toISOString() ?? null,
    currentBalanceCents: currentBalanceCents(account),
  }
}

function sumBalances(accounts: Account[]): number {
  return accounts.reduce(
    (total, account) => total + account.currentBalanceCents,
    0,
  )
}

export function buildAccountOverview(accounts: Account[]): AccountOverview {
  const active = accounts.filter((account) => account.archivedAt === null)
  const groups = accountUsages.flatMap((usage) => {
    const members = active.filter((account) => account.usage === usage)
    return members.length === 0
      ? []
      : [{ usage, subtotalCents: sumBalances(members), accounts: members }]
  })
  return {
    totalCents: groups.reduce((total, group) => total + group.subtotalCents, 0),
    groups,
    archived: accounts.filter((account) => account.archivedAt !== null),
  }
}

export async function findUserAccount(
  app: AppDependencies,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<AccountModel> {
  const account = await app.models.Account.findOne({
    where: { id, userId },
    transaction,
  })
  if (account === null) {
    throw notFound()
  }
  return account
}

export async function nextAccountSortOrder(
  app: AppDependencies,
  userId: string,
  usage: AccountUsage,
  transaction?: Transaction,
): Promise<number> {
  const last = await app.models.Account.findOne({
    where: { userId, usage, archivedAt: null },
    order: [['sortOrder', 'DESC']],
    transaction,
  })
  return last === null ? 0 : last.sortOrder + 1
}

export function validateAccountFields(
  app: AppDependencies,
  fields: unknown,
): CreateAccountRequest {
  const result = createAccountRequestSchema.safeParse(fields)
  if (!result.success) {
    throw validationFailed(toIssues(result.error))
  }
  if (result.data.initialBalanceDate > parisDate(app.clock.now())) {
    throw validationFailed([
      { path: ['initialBalanceDate'], message: 'date_in_future' },
    ])
  }
  return result.data
}

export function accountFields(account: AccountModel): CreateAccountRequest {
  return {
    name: account.name,
    nature: account.nature,
    regulatedProduct: account.regulatedProduct,
    usage: account.usage,
    institution: account.institution,
    initialBalanceCents: account.initialBalanceCents,
    initialBalanceDate: account.initialBalanceDate,
    lowBalanceThresholdCents: account.lowBalanceThresholdCents,
  }
}
