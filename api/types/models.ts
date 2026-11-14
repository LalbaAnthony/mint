import type { Model, ModelStatic, Optional } from 'sequelize'
import type {
  AccountNature,
  AccountUsage,
  RegulatedProduct,
} from '@mint/shared/types/accounts'
import type { CategoryKind, ExpenseGroup } from '@mint/shared/types/categories'
import type { PaymentMethodKind } from '@mint/shared/types/payment-methods'
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

export type Models = {
  User: ModelStatic<UserModel>
  Session: ModelStatic<SessionModel>
  Invitation: ModelStatic<InvitationModel>
  PasswordResetToken: ModelStatic<PasswordResetTokenModel>
  EmailChangeToken: ModelStatic<EmailChangeTokenModel>
  Category: ModelStatic<CategoryModel>
  Account: ModelStatic<AccountModel>
  PaymentMethod: ModelStatic<PaymentMethodModel>
}
