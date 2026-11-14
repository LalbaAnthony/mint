import type { AccountInput } from './accounts.js'
import type { CategoryInput } from './categories.js'
import type { OperationInput } from './transactions.js'

export type CategorySpending = {
  categoryId: string
  totalCents: number
}

export type GroupSpending = {
  totalCents: number
  categories: CategorySpending[]
}

export type SpendingBreakdown = {
  needs: GroupSpending
  wants: GroupSpending
  saveCents: number
  toCategorizeCents: number
}

export type SpendingBreakdownInput = {
  from: string
  to: string
  operations: OperationInput[]
  categories: CategoryInput[]
  accounts: AccountInput[]
}

export type MonthlyIncomeExpense = {
  month: string
  incomeCents: number
  expenseCents: number
  balanceCents: number
}

export type MonthlyIncomeExpenseInput = {
  fromMonth: string
  toMonth: string
  operations: OperationInput[]
  categories: CategoryInput[]
}
