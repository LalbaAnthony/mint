import type { Model, ModelStatic, Optional } from 'sequelize'
import type {
  AccountNature,
  AccountUsage,
  RegulatedProduct,
} from '@mint/shared/types/accounts'
import type { CategoryKind, ExpenseGroup } from '@mint/shared/types/categories'
import type { PaymentMethodKind } from '@mint/shared/types/payment-methods'
import type {
  BusinessDayRule,
  OccurrenceState,
  ScheduleFrequency,
  ScheduleKind,
  TriggerMode,
} from '@mint/shared/types/schedules'
import type {
  TransactionOrigin,
  TransactionStatus,
} from '@mint/shared/types/transactions'
import type { Locale, UserRole, UserStatus } from '@mint/shared/types/user'

export type UserAttributes = {
  id: string
  email: string
  passwordHash: string
  role: UserRole
  locale: Locale
  status: UserStatus
  forecastHorizonMonths: number
  targetNeedsPct: number
  targetWantsPct: number
  targetSavePct: number
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type UserCreationAttributes = Optional<
  UserAttributes,
  | 'id'
  | 'status'
  | 'forecastHorizonMonths'
  | 'targetNeedsPct'
  | 'targetWantsPct'
  | 'targetSavePct'
  | 'lastLoginAt'
  | 'createdAt'
  | 'updatedAt'
>

export type UserModel = Model<UserAttributes, UserCreationAttributes> &
  UserAttributes

export type SessionAttributes = {
  id: string
  sid: string
  userId: string
  data: unknown
  expiresAt: Date
  userAgent: string | null
  ip: string | null
  lastSeenAt: Date
  createdAt: Date
  updatedAt: Date
}

export type SessionCreationAttributes = Optional<
  SessionAttributes,
  'id' | 'userAgent' | 'ip' | 'lastSeenAt' | 'createdAt' | 'updatedAt'
>

export type SessionModel = Model<SessionAttributes, SessionCreationAttributes> &
  SessionAttributes

export type InvitationAttributes = {
  id: string
  email: string
  tokenHash: string
  invitedBy: string | null
  expiresAt: Date
  acceptedAt: Date | null
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type InvitationCreationAttributes = Optional<
  InvitationAttributes,
  'id' | 'acceptedAt' | 'revokedAt' | 'createdAt' | 'updatedAt'
>

export type InvitationModel = Model<
  InvitationAttributes,
  InvitationCreationAttributes
> &
  InvitationAttributes

export type PasswordResetTokenAttributes = {
  id: string
  userId: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type PasswordResetTokenCreationAttributes = Optional<
  PasswordResetTokenAttributes,
  'id' | 'usedAt' | 'createdAt' | 'updatedAt'
>

export type PasswordResetTokenModel = Model<
  PasswordResetTokenAttributes,
  PasswordResetTokenCreationAttributes
> &
  PasswordResetTokenAttributes

export type EmailChangeTokenAttributes = {
  id: string
  userId: string
  newEmail: string
  tokenHash: string
  expiresAt: Date
  usedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type EmailChangeTokenCreationAttributes = Optional<
  EmailChangeTokenAttributes,
  'id' | 'usedAt' | 'createdAt' | 'updatedAt'
>

export type EmailChangeTokenModel = Model<
  EmailChangeTokenAttributes,
  EmailChangeTokenCreationAttributes
> &
  EmailChangeTokenAttributes

export type CategoryAttributes = {
  id: string
  userId: string
  parentId: string | null
  kind: CategoryKind
  expenseGroup: ExpenseGroup | null
  name: string
  isSystem: boolean
  sortOrder: number
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type CategoryCreationAttributes = Optional<
  CategoryAttributes,
  | 'id'
  | 'parentId'
  | 'expenseGroup'
  | 'isSystem'
  | 'sortOrder'
  | 'archivedAt'
  | 'createdAt'
  | 'updatedAt'
>

export type CategoryModel = Model<
  CategoryAttributes,
  CategoryCreationAttributes
> &
  CategoryAttributes

export type AccountAttributes = {
  id: string
  userId: string
  name: string
  nature: AccountNature
  regulatedProduct: RegulatedProduct | null
  usage: AccountUsage
  institution: string | null
  initialBalanceCents: number
  initialBalanceDate: string
  lowBalanceThresholdCents: number | null
  sortOrder: number
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type AccountCreationAttributes = Optional<
  AccountAttributes,
  | 'id'
  | 'regulatedProduct'
  | 'institution'
  | 'lowBalanceThresholdCents'
  | 'sortOrder'
  | 'archivedAt'
  | 'createdAt'
  | 'updatedAt'
>

export type AccountModel = Model<AccountAttributes, AccountCreationAttributes> &
  AccountAttributes

export type PaymentMethodAttributes = {
  id: string
  userId: string
  accountId: string
  label: string
  kind: PaymentMethodKind
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type PaymentMethodCreationAttributes = Optional<
  PaymentMethodAttributes,
  'id' | 'archivedAt' | 'createdAt' | 'updatedAt'
>

export type PaymentMethodModel = Model<
  PaymentMethodAttributes,
  PaymentMethodCreationAttributes
> &
  PaymentMethodAttributes

export type ScheduleAttributes = {
  id: string
  userId: string
  kind: ScheduleKind
  label: string
  amountCents: number
  paymentMethodId: string | null
  accountId: string | null
  sourceAccountId: string | null
  targetAccountId: string | null
  categoryId: string | null
  isSubscription: boolean
  triggerMode: TriggerMode
  frequency: ScheduleFrequency
  interval: number
  startDate: string
  anchorLastDay: boolean
  endDate: string | null
  maxOccurrences: number | null
  businessDayRule: BusinessDayRule
  note: string | null
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type ScheduleCreationAttributes = Optional<
  ScheduleAttributes,
  | 'id'
  | 'paymentMethodId'
  | 'accountId'
  | 'sourceAccountId'
  | 'targetAccountId'
  | 'categoryId'
  | 'isSubscription'
  | 'triggerMode'
  | 'interval'
  | 'anchorLastDay'
  | 'endDate'
  | 'maxOccurrences'
  | 'businessDayRule'
  | 'note'
  | 'active'
  | 'createdAt'
  | 'updatedAt'
>

export type ScheduleModel = Model<
  ScheduleAttributes,
  ScheduleCreationAttributes
> &
  ScheduleAttributes

export type ScheduleOccurrenceAttributes = {
  id: string
  scheduleId: string
  originalDate: string
  effectiveDate: string | null
  amountCents: number | null
  state: OccurrenceState
  createdAt: Date
  updatedAt: Date
}

export type ScheduleOccurrenceCreationAttributes = Optional<
  ScheduleOccurrenceAttributes,
  'id' | 'effectiveDate' | 'amountCents' | 'createdAt' | 'updatedAt'
>

export type ScheduleOccurrenceModel = Model<
  ScheduleOccurrenceAttributes,
  ScheduleOccurrenceCreationAttributes
> &
  ScheduleOccurrenceAttributes

export type TransactionAttributes = {
  id: string
  userId: string
  accountId: string
  paymentMethodId: string | null
  date: string
  amountCents: number
  label: string
  note: string | null
  categoryId: string | null
  status: TransactionStatus
  origin: TransactionOrigin
  transferGroupId: string | null
  occurrenceId: string | null
  createdAt: Date
  updatedAt: Date
}

export type TransactionCreationAttributes = Optional<
  TransactionAttributes,
  | 'id'
  | 'paymentMethodId'
  | 'note'
  | 'categoryId'
  | 'transferGroupId'
  | 'occurrenceId'
  | 'createdAt'
  | 'updatedAt'
>

export type TransactionModel = Model<
  TransactionAttributes,
  TransactionCreationAttributes
> &
  TransactionAttributes

export type EnvelopeAttributes = {
  id: string
  userId: string
  label: string
  monthlyAmountCents: number
  paymentMethodId: string | null
  accountId: string | null
  carryOver: boolean
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type EnvelopeCreationAttributes = Optional<
  EnvelopeAttributes,
  | 'id'
  | 'paymentMethodId'
  | 'accountId'
  | 'carryOver'
  | 'active'
  | 'createdAt'
  | 'updatedAt'
>

export type EnvelopeModel = Model<
  EnvelopeAttributes,
  EnvelopeCreationAttributes
> &
  EnvelopeAttributes

export type EnvelopeCategoryAttributes = {
  id: string
  userId: string
  envelopeId: string
  categoryId: string
  createdAt: Date
  updatedAt: Date
}

export type EnvelopeCategoryCreationAttributes = Optional<
  EnvelopeCategoryAttributes,
  'id' | 'createdAt' | 'updatedAt'
>

export type EnvelopeCategoryModel = Model<
  EnvelopeCategoryAttributes,
  EnvelopeCategoryCreationAttributes
> &
  EnvelopeCategoryAttributes

export type Models = {
  User: ModelStatic<UserModel>
  Session: ModelStatic<SessionModel>
  Invitation: ModelStatic<InvitationModel>
  PasswordResetToken: ModelStatic<PasswordResetTokenModel>
  EmailChangeToken: ModelStatic<EmailChangeTokenModel>
  Category: ModelStatic<CategoryModel>
  Account: ModelStatic<AccountModel>
  PaymentMethod: ModelStatic<PaymentMethodModel>
  Schedule: ModelStatic<ScheduleModel>
  ScheduleOccurrence: ModelStatic<ScheduleOccurrenceModel>
  Transaction: ModelStatic<TransactionModel>
  Envelope: ModelStatic<EnvelopeModel>
  EnvelopeCategory: ModelStatic<EnvelopeCategoryModel>
}
