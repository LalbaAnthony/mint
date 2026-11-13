import type { Locale } from '@mint/shared/types/user'
import type { CategoryKind, ExpenseGroup } from './models.js'

export type DefaultCategory = {
  kind: CategoryKind
  expenseGroup: ExpenseGroup | null
  names: Record<Locale, string>
}
