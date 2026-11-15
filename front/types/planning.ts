import type { Account } from '@mint/shared/types/accounts'
import type { Category, CategoryKind } from '@mint/shared/types/categories'
import type { Envelope, EnvelopeMonthLine } from '@mint/shared/types/envelopes'
import type {
  Operation,
  OperationDirection,
  OperationGroup,
  OperationSortField,
  SortOrder,
} from '@mint/shared/types/operations'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import type {
  BusinessDayRule,
  Schedule,
  ScheduleFrequency,
  ScheduleKind,
  ScheduleOccurrence,
  TriggerMode,
} from '@mint/shared/types/schedules'
import type {
  TransactionOrigin,
  TransactionStatus,
} from '@mint/shared/types/transactions'
import type { QuickAddKind } from './navigation'

export type OperationEditorRequest =
  | { mode: 'create'; kind: QuickAddKind }
  | { mode: 'edit'; operation: Operation }

export type PaymentSourceValue = `account:${string}` | `method:${string}`

export type PaymentSource = {
  accountId: string | null
  paymentMethodId: string | null
}

export type PaymentSourceItem = {
  label: string
  value: PaymentSourceValue
}

export type CategoryOption = {
  label: string
  value: string
}

export type CategoryOptionGroup = {
  kind: CategoryKind
  label: string
  options: CategoryOption[]
}

export type OperationFormState = {
  kind: QuickAddKind
  source: PaymentSourceValue | undefined
  sourceAccountId: string | undefined
  targetAccountId: string | undefined
  date: string
  amount: string
  label: string
  categoryId: string | undefined
  note: string
}

export type OperationFilterState = {
  q: string
  from: string
  to: string
  accountIds: string[]
  groups: OperationGroup[]
  categoryIds: string[]
  minAmount: string
  maxAmount: string
  direction: OperationDirection | undefined
  origins: TransactionOrigin[]
  status: TransactionStatus | undefined
  reconciled: boolean | undefined
  unconfirmed: boolean
}

export type OperationSorting = {
  sort: OperationSortField
  order: SortOrder
}

export type ScheduleEndMode = 'never' | 'date' | 'count'

export type ScheduleFormState = {
  kind: ScheduleKind
  label: string
  amount: string
  source: PaymentSourceValue | undefined
  sourceAccountId: string | undefined
  targetAccountId: string | undefined
  categoryId: string | undefined
  isSubscription: boolean
  triggerMode: TriggerMode
  frequency: ScheduleFrequency
  interval: number
  startDate: string
  anchorLastDay: boolean
  endMode: ScheduleEndMode
  endDate: string
  maxOccurrences: number
  businessDayRule: BusinessDayRule
  note: string
  active: boolean
  amountTolerancePct: number
  bankLabelPatterns: string[]
}

export type ScheduleKindFilter = ScheduleKind | 'all'

export type OccurrenceFormState = {
  amount: string
  effectiveDate: string
}

export type EnvelopeFormState = {
  label: string
  amount: string
  source: PaymentSourceValue | undefined
  carryOver: boolean
  active: boolean
  categoryIds: string[]
}

export type EnvelopeTone = 'primary' | 'warning' | 'error'

export type PlanningMarkerKind = 'manual' | 'subscription'

export interface PlanningMarkerProps {
  kind: PlanningMarkerKind
}

export type UsageNotice = {
  blocked: boolean
  description: string
}

export interface OperationRowProps {
  operation: Operation
}

export interface OperationBadgesProps {
  operation: Operation
}

export interface OperationLinksPanelProps {
  operation: Operation
}

export type OperationRowEmits = {
  edit: [operation: Operation]
  delete: [operation: Operation]
}

export interface OperationFiltersProps {
  accounts: Account[]
  categories: Category[]
}

export interface ScheduleFormModalProps {
  schedule: Schedule | null
}

export type ScheduleFormModalEmits = {
  saved: [schedule: Schedule, removedExceptions: number]
}

export interface ScheduleDetailModalProps {
  schedule: Schedule | null
}

export type ScheduleDetailModalEmits = {
  edit: [schedule: Schedule]
  changed: []
}

export interface OccurrenceFormModalProps {
  scheduleId: string
  occurrence: ScheduleOccurrence | null
}

export type OccurrenceFormModalEmits = {
  saved: [occurrence: ScheduleOccurrence]
}

export interface EnvelopeFormModalProps {
  envelope: Envelope | null
  takenCategoryIds: string[]
}

export type EnvelopeFormModalEmits = {
  saved: [envelope: Envelope]
}

export interface EnvelopeCardProps {
  line: EnvelopeMonthLine
  currentMonth: boolean
}

export type EnvelopeCardEmits = {
  edit: [envelope: Envelope]
  delete: [envelope: Envelope]
}

export interface CategoryDeleteModalProps {
  category: Category | null
  categories: Category[]
}

export type CategoryDeleteModalEmits = {
  deleted: [category: Category]
}

export interface ReferentialsState {
  accounts: Account[]
  paymentMethods: PaymentMethod[]
  categories: Category[]
}
