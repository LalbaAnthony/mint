import type { Account } from '@mint/shared/types/accounts'
import type { Category } from '@mint/shared/types/categories'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'

export type MoneyVariant = 'balance' | 'flow'

export type MoneyState =
  'normal' | 'belowThreshold' | 'negative' | 'credit' | 'debit'

export type DataTone =
  | 'current'
  | 'emergency'
  | 'savings'
  | 'investment'
  | 'needs'
  | 'wants'
  | 'save'

export type AccountActionKind =
  'edit' | 'archive' | 'restore' | 'delete' | 'addPaymentMethod' | 'statements'

export type AccountAction = {
  kind: AccountActionKind
  account: Account
}

export type PaymentMethodActionKind = 'edit' | 'archive' | 'restore' | 'delete'

export type PaymentMethodAction = {
  kind: PaymentMethodActionKind
  paymentMethod: PaymentMethod
}

export type CategoryActionKind =
  'edit' | 'addChild' | 'archive' | 'restore' | 'delete'

export type CategoryAction = {
  kind: CategoryActionKind
  category: Category
}

export type CategoryNode = {
  category: Category
  children: CategoryNode[]
}

export type CategorySectionId = 'needs' | 'wants' | 'income' | 'system'

export type CategorySection = {
  id: CategorySectionId
  nodes: CategoryNode[]
}

export type SortableListOptions = {
  scope: string
  ids: () => string[]
  onReorder: (ids: string[]) => void
}
