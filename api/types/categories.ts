import type {
  CategoryKind,
  EditableCategoryKind,
  ExpenseGroup,
} from '@mint/shared/types/categories'
import type { Locale } from '@mint/shared/types/user'

export type DefaultCategory = {
  kind: EditableCategoryKind
  expenseGroup: ExpenseGroup | null
  names: Record<Locale, string>
}

export type SystemCategory = {
  kind: Exclude<CategoryKind, 'expense'>
  names: Record<Locale, string>
}

export type CategorySiblingScope = {
  parentId: string | null
  kind: CategoryKind
  expenseGroup: ExpenseGroup | null
}
