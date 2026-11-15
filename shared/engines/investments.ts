import type { AccountInput } from '../types/accounts.js'
import type { OperationInput } from '../types/transactions.js'
import type { InvestmentSummary } from '../types/valuations.js'
import { latestValuation, referenceBalanceCents } from './balances.js'

export function paidInCents(
  account: AccountInput,
  operations: readonly OperationInput[],
  date: string,
): number {
  return operations
    .filter(
      (operation) =>
        operation.accountId === account.id &&
        operation.transferGroupId !== null &&
        operation.date >= account.initialBalanceDate &&
        operation.date <= date,
    )
    .reduce(
      (total, operation) => total + operation.amountCents,
      account.initialBalanceCents,
    )
}

export function investmentSummary(
  account: AccountInput,
  operations: readonly OperationInput[],
  today: string,
): InvestmentSummary {
  const paidIn = paidInCents(account, operations, today)
  const reference =
    referenceBalanceCents(account, operations, today) ??
    account.initialBalanceCents
  const lastValuation = latestValuation(account, today)
  return {
    paidInCents: paidIn,
    referenceBalanceCents: reference,
    lastValuation,
    latentGainCents: lastValuation === null ? null : reference - paidIn,
  }
}
