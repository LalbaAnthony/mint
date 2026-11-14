import type { Locale, UserRole, UserStatus } from '@mint/shared/types/user'
import type { CategoryKind, ExpenseGroup } from './models.js'

export type SeedUser = {
  email: string
  role: UserRole
  locale: Locale
  status: UserStatus
  lastLoginAt: Date | null
  customizedCategories: boolean
}

export type SeedTopLevelCategory = {
  kind: CategoryKind
  expenseGroup: ExpenseGroup | null
  name: string
  archived: boolean
}

export type SeedSubcategory = {
  name: string
  archived: boolean
}

export type SeedSubcategoryGroup = {
  parentName: string
  children: SeedSubcategory[]
}

export type SeedSummary = {
  users: number
  administratorEmail: string
  customizedUserEmail: string
  password: string
}
