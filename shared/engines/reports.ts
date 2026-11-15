import type { AccountInput, AccountUsage } from '../types/accounts.js'
import type { CategoryInput, ExpenseGroup } from '../types/categories.js'
import type {
  ForecastMonthlyInput,
  GroupSpending,
  MonthlyIncomeExpense,
  MonthlyIncomeExpenseInput,
  SpendingBreakdown,
  SpendingBreakdownInput,
} from '../types/reports.js'
import type { OperationInput } from '../types/transactions.js'
import { enumerateMonths, isWithin, monthStart } from './dates.js'
import { compareCodeUnits } from './ordering.js'

const savingsUsages: ReadonlySet<AccountUsage> = new Set([
  'emergency',
  'savings',
  'investment',
])

function indexById<T extends { id: string }>(
  items: readonly T[],
): Map<string, T> {
  return new Map(items.map((item) => [item.id, item]))
}

function requireItem<T>(
  items: ReadonlyMap<string, T>,
  id: string,
  kind: string,
): T {
  const item = items.get(id)
  if (item === undefined) {
    throw new RangeError(`Unknown ${kind} ${id}`)
  }
  return item
}

function expenseGroupOf(
  category: CategoryInput,
  categories: ReadonlyMap<string, CategoryInput>,
): { root: CategoryInput; group: ExpenseGroup } {
  const root =
    category.parentId === null
      ? category
      : requireItem(categories, category.parentId, 'category')
  if (root.expenseGroup === null) {
    throw new RangeError(`Expense category ${root.id} has no group`)
  }
  return { root, group: root.expenseGroup }
}

function toGroupSpending(
  byCategory: ReadonlyMap<string, number>,
): GroupSpending {
  const categories = [...byCategory.entries()]
    .map(([categoryId, totalCents]) => ({ categoryId, totalCents }))
    .sort(
      (first, second) =>
        second.totalCents - first.totalCents ||
        compareCodeUnits(first.categoryId, second.categoryId),
    )
  return {
    totalCents: categories.reduce(
      (total, category) => total + category.totalCents,
      0,
    ),
    categories,
  }
}

function transferGroups(
  operations: readonly OperationInput[],
): Map<string, OperationInput[]> {
  const groups = new Map<string, OperationInput[]>()
  for (const operation of operations) {
    if (operation.transferGroupId === null) {
      continue
    }
    const movements = groups.get(operation.transferGroupId)
    if (movements === undefined) {
      groups.set(operation.transferGroupId, [operation])
    } else {
      movements.push(operation)
    }
  }
  return groups
}

export function savingsTransfersCents(
  operations: readonly OperationInput[],
  accounts: readonly AccountInput[],
  from: string,
  to: string,
): number {
  const accountsById = indexById(accounts)
  let saveCents = 0
  for (const [groupId, movements] of transferGroups(operations)) {
    const debit = movements.find((movement) => movement.amountCents < 0)
    const credit = movements.find((movement) => movement.amountCents > 0)
    if (movements.length !== 2 || debit === undefined || credit === undefined) {
      throw new RangeError(`Transfer group ${groupId} is incomplete`)
    }
    if (!isWithin(debit.date, from, to)) {
      continue
    }
    const source = requireItem(accountsById, debit.accountId, 'account')
    const target = requireItem(accountsById, credit.accountId, 'account')
    if (source.usage === 'current' && savingsUsages.has(target.usage)) {
      saveCents -= debit.amountCents
    }
  }
  return saveCents
}

export function spendingBreakdown(
  input: SpendingBreakdownInput,
): SpendingBreakdown {
  const categories = indexById(input.categories)
  const spendingByGroup: Record<ExpenseGroup, Map<string, number>> = {
    needs: new Map(),
    wants: new Map(),
  }
  let toCategorizeCents = 0
  for (const operation of input.operations) {
    if (
      operation.transferGroupId !== null ||
      !isWithin(operation.date, input.from, input.to)
    ) {
      continue
    }
    if (operation.categoryId === null) {
      if (operation.amountCents < 0) {
        toCategorizeCents -= operation.amountCents
      }
      continue
    }
    const category = requireItem(categories, operation.categoryId, 'category')
    if (category.kind !== 'expense') {
      continue
    }
    const { root, group } = expenseGroupOf(category, categories)
    const byCategory = spendingByGroup[group]
    byCategory.set(
      root.id,
      (byCategory.get(root.id) ?? 0) - operation.amountCents,
    )
  }
  return {
    needs: toGroupSpending(spendingByGroup.needs),
    wants: toGroupSpending(spendingByGroup.wants),
    saveCents: savingsTransfersCents(
      input.operations,
      input.accounts,
      input.from,
      input.to,
    ),
    toCategorizeCents,
  }
}

export function monthlyIncomeExpenses(
  input: MonthlyIncomeExpenseInput,
): MonthlyIncomeExpense[] {
  const categories = indexById(input.categories)
  const totals = new Map(
    enumerateMonths(input.fromMonth, input.toMonth).map((month) => [
      month,
      { incomeCents: 0, expenseCents: 0 },
    ]),
  )
  for (const operation of input.operations) {
    const monthTotals = totals.get(monthStart(operation.date))
    if (monthTotals === undefined || operation.transferGroupId !== null) {
      continue
    }
    const kind =
      operation.categoryId === null
        ? null
        : requireItem(categories, operation.categoryId, 'category').kind
    if (kind === 'adjustment') {
      continue
    }
    const isIncome =
      kind === 'income' || (kind === null && operation.amountCents > 0)
    if (isIncome) {
      monthTotals.incomeCents += operation.amountCents
    } else {
      monthTotals.expenseCents -= operation.amountCents
    }
  }
  return [...totals.entries()].map(
    ([month, { incomeCents, expenseCents }]) => ({
      month,
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
    }),
  )
}

export function forecastMonthlyIncomeExpenses(
  input: ForecastMonthlyInput,
): MonthlyIncomeExpense[] {
  const categories = indexById(input.categories)
  const operations = indexById(input.operations)
  const totals = new Map(
    enumerateMonths(input.forecast.startDate, input.forecast.endDate).map(
      (month) => [month, { incomeCents: 0, expenseCents: 0 }],
    ),
  )
  for (const account of input.forecast.accounts) {
    for (const day of account.days) {
      const monthTotals = totals.get(monthStart(day.date))
      if (monthTotals === undefined) {
        continue
      }
      for (const flow of day.flows) {
        if (flow.source === 'occurrence') {
          if (flow.kind === 'income') {
            monthTotals.incomeCents += flow.amountCents
          } else if (flow.kind === 'expense') {
            monthTotals.expenseCents -= flow.amountCents
          }
          continue
        }
        if (flow.source === 'envelope') {
          monthTotals.expenseCents -= flow.amountCents
          continue
        }
        const operation = requireItem(operations, flow.operationId, 'operation')
        if (operation.transferGroupId !== null) {
          continue
        }
        const kind =
          operation.categoryId === null
            ? null
            : requireItem(categories, operation.categoryId, 'category').kind
        if (kind === 'adjustment') {
          continue
        }
        if (kind === 'income' || (kind === null && flow.amountCents > 0)) {
          monthTotals.incomeCents += flow.amountCents
        } else {
          monthTotals.expenseCents -= flow.amountCents
        }
      }
    }
  }
  return [...totals.entries()].map(
    ([month, { incomeCents, expenseCents }]) => ({
      month,
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
    }),
  )
}
