import type { Locale, UserRole, UserStatus } from '@mint/shared/types/user'
import type {
  AccountNature,
  AccountUsage,
  RegulatedProduct,
} from '@mint/shared/types/accounts'
import type {
  EditableCategoryKind,
  ExpenseGroup,
} from '@mint/shared/types/categories'
import type { PaymentMethodKind } from '@mint/shared/types/payment-methods'

export type SeedUser = {
  email: string
  role: UserRole
  locale: Locale
  status: UserStatus
  lastLoginAt: Date | null
  customizedCategories: boolean
  withAccounts: boolean
}

export type SeedAccount = {
  name: string
  nature: AccountNature
  regulatedProduct: RegulatedProduct | null
  usage: AccountUsage
  institution: string | null
  initialBalanceCents: number
  lowBalanceThresholdCents: number | null
  archived: boolean
}

export type SeedPaymentMethod = {
  label: string
  kind: PaymentMethodKind
  accountName: string
  archived: boolean
}

export type SeedTopLevelCategory = {
  kind: EditableCategoryKind
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
