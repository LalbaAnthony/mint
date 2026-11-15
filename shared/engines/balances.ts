import type { AccountInput } from '../types/accounts.js'
import type { DailyBalance } from '../types/forecast.js'
import type { OperationInput } from '../types/transactions.js'
import { enumerateDays } from './dates.js'

function countedOperations(
  account: AccountInput,
  operations: readonly OperationInput[],
): OperationInput[] {
  return operations.filter(
    (operation) =>
      operation.accountId === account.id &&
      operation.date >= account.initialBalanceDate,
  )
}

export function calculatedBalanceCents(
  account: AccountInput,
  operations: readonly OperationInput[],
  date: string,
): number | null {
  if (date < account.initialBalanceDate) {
    return null
  }
  return countedOperations(account, operations)
    .filter((operation) => operation.date <= date)
    .reduce(
      (balance, operation) => balance + operation.amountCents,
      account.initialBalanceCents,
    )
}

export function endOfDayBalances(
  account: AccountInput,
  operations: readonly OperationInput[],
  from: string,
  to: string,
): DailyBalance[] {
  const movementsByDate = new Map<string, number>()
  for (const operation of countedOperations(account, operations)) {
    movementsByDate.set(
      operation.date,
      (movementsByDate.get(operation.date) ?? 0) + operation.amountCents,
    )
  }
  const days = enumerateDays(from, to)
  const first = days[0]
  if (first === undefined) {
    return []
  }
  let balance = calculatedBalanceCents(account, operations, first)
  return days.map((date, index) => {
    if (index > 0 && date >= account.initialBalanceDate) {
      balance =
        (balance ?? account.initialBalanceCents) +
        (movementsByDate.get(date) ?? 0)
    }
    return { date, balanceCents: balance }
  })
}

export function aggregateEndOfDayBalances(
  accounts: readonly AccountInput[],
  operations: readonly OperationInput[],
  from: string,
  to: string,
): DailyBalance[] {
  const perAccount = accounts.map((account) =>
    endOfDayBalances(account, operations, from, to),
  )
  return enumerateDays(from, to).map((date, index) => {
    let balanceCents: number | null = null
    for (const balances of perAccount) {
      const balance = balances[index]?.balanceCents ?? null
      if (balance !== null) {
        balanceCents = (balanceCents ?? 0) + balance
      }
    }
    return { date, balanceCents }
  })
}
