import type { Account, AccountUsageGroup } from '@mint/shared/types/accounts'
import type { Category } from '@mint/shared/types/categories'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import type {
  AccountAction,
  CategoryAction,
  CategoryNode,
  DataTone,
  MoneyVariant,
  PaymentMethodAction,
} from './referentials'

export interface ViewPanelProps {
  title: string
}

export interface AppBrandProps {
  variant: 'sidebar' | 'login'
  collapsed?: boolean
}

export interface AppFormFieldProps {
  label: string
  name: string
  hint?: string
}

export interface EmptyStateProps {
  icon: string
  title: string
  description: string
}

export interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
  blocked?: boolean
}

export type ConfirmModalEmits = {
  confirm: []
}

export interface MoneyAmountProps {
  cents: number
  variant?: MoneyVariant
  threshold?: number | null
}

export interface DataDotProps {
  tone: DataTone
}

export interface AccountGroupCardProps {
  group: AccountUsageGroup
  paymentMethods: PaymentMethod[]
  reordering: boolean
  expandedIds: string[]
}

export type AccountGroupCardEmits = {
  reorder: [accountIds: string[]]
  toggle: [accountId: string]
  accountAction: [action: AccountAction]
  paymentMethodAction: [action: PaymentMethodAction]
}

export interface PaymentMethodListProps {
  account: Account
  paymentMethods: PaymentMethod[]
}

export type PaymentMethodListEmits = {
  accountAction: [action: AccountAction]
  paymentMethodAction: [action: PaymentMethodAction]
}

export interface ArchivedAccountsCardProps {
  accounts: Account[]
}

export type ArchivedAccountsCardEmits = {
  accountAction: [action: AccountAction]
}

export interface AccountFormModalProps {
  account: Account | null
}

export type AccountFormModalEmits = {
  saved: [account: Account]
}

export interface PaymentMethodFormModalProps {
  paymentMethod: PaymentMethod | null
  accountId: string | null
  accounts: Account[]
}

export type PaymentMethodFormModalEmits = {
  saved: [paymentMethod: PaymentMethod]
}

export interface CategoryListProps {
  nodes: CategoryNode[]
  reordering: boolean
  nested?: boolean
}

export type CategoryListEmits = {
  reorder: [categoryIds: string[]]
  action: [action: CategoryAction]
}

export interface CategoryFormModalProps {
  category: Category | null
  parent: Category | null
  parents: Category[]
}

export type CategoryFormModalEmits = {
  saved: [category: Category]
}
