import type { Model, ModelStatic, Optional } from 'sequelize'
import type {
  AccountNature,
  AccountUsage,
  RegulatedProduct,
} from '@mint/shared/types/accounts'
import type { CategoryKind, ExpenseGroup } from '@mint/shared/types/categories'
import type {
  Capitalization,
  InterestMethod,
} from '@mint/shared/types/interest'
import type {
  CsvMapping,
  ImportBatch,
  ImportLineError,
} from '@mint/shared/types/imports'
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
import type { RuleMatchType, RuleSign } from '@mint/shared/types/rules'
import type { Locale, UserRole, UserStatus } from '@mint/shared/types/user'
import type { NotificationType } from '@mint/shared/types/notifications'

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
  depositCapCents: number | null
  capitalizedInterestCents: number | null
  interestMethod: InterestMethod | null
  capitalization: Capitalization | null
  anniversaryDate: string | null
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
  | 'depositCapCents'
  | 'capitalizedInterestCents'
  | 'interestMethod'
  | 'capitalization'
  | 'anniversaryDate'
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
  amountTolerancePct: number
  bankLabelPatterns: string[]
  isSystem: boolean
  reminderDaysBefore: number
  createdOn: string
  createdAt: Date
  updatedAt: Date
}

export type ScheduleCreationAttributes = Optional<
  ScheduleAttributes,
  | 'amountTolerancePct'
  | 'bankLabelPatterns'
  | 'isSystem'
  | 'reminderDaysBefore'
  | 'createdOn'
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
  bankLabel: string | null
  importBatchId: string | null
  dedupHash: string | null
  preMergeSnapshot: unknown
  createdAt: Date
  updatedAt: Date
}

export type TransactionCreationAttributes = Optional<
  TransactionAttributes,
  | 'bankLabel'
  | 'importBatchId'
  | 'dedupHash'
  | 'preMergeSnapshot'
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
  createdOn: string
  createdAt: Date
  updatedAt: Date
}

export type EnvelopeCreationAttributes = Optional<
  EnvelopeAttributes,
  | 'createdOn'
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

export type EnvelopeMonthOverrideAttributes = {
  id: string
  envelopeId: string
  month: string
  amountCents: number
  createdAt: Date
  updatedAt: Date
}

export type EnvelopeMonthOverrideCreationAttributes = Optional<
  EnvelopeMonthOverrideAttributes,
  'id' | 'createdAt' | 'updatedAt'
>

export type EnvelopeMonthOverrideModel = Model<
  EnvelopeMonthOverrideAttributes,
  EnvelopeMonthOverrideCreationAttributes
> &
  EnvelopeMonthOverrideAttributes

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
  EnvelopeMonthOverride: ModelStatic<EnvelopeMonthOverrideModel>
  ImportMapping: ModelStatic<ImportMappingModel>
  ImportBatch: ModelStatic<ImportBatchModel>
  ImportRow: ModelStatic<ImportRowModel>
  CategorizationRule: ModelStatic<CategorizationRuleModel>
  AccountStatement: ModelStatic<AccountStatementModel>
  Tag: ModelStatic<TagModel>
  TransactionTag: ModelStatic<TransactionTagModel>
  ScheduleTag: ModelStatic<ScheduleTagModel>
  Valuation: ModelStatic<ValuationModel>
  InterestRate: ModelStatic<InterestRateModel>
  RegulatedCap: ModelStatic<RegulatedCapModel>
  Notification: ModelStatic<NotificationModel>
  AlertEpisode: ModelStatic<AlertEpisodeModel>
  PushSubscription: ModelStatic<PushSubscriptionModel>
  NotificationPreference: ModelStatic<NotificationPreferenceModel>
  WebauthnCredential: ModelStatic<WebauthnCredentialModel>
}

export type ImportMappingAttributes = {
  id: string
  userId: string
  accountId: string
  delimiter: CsvMapping['delimiter']
  encoding: CsvMapping['encoding']
  hasHeader: boolean
  skipTop: number
  skipBottom: number
  dateFormat: CsvMapping['dateFormat']
  decimalSeparator: CsvMapping['decimalSeparator']
  colDate: number
  colLabel: number
  colAmount: number | null
  colDebit: number | null
  colCredit: number | null
  createdAt: Date
  updatedAt: Date
}

export type ImportMappingCreationAttributes = Optional<
  ImportMappingAttributes,
  'id' | 'createdAt' | 'updatedAt'
>

export type ImportMappingModel = Model<
  ImportMappingAttributes,
  ImportMappingCreationAttributes
> &
  ImportMappingAttributes

export type ImportBatchAttributes = {
  id: string
  userId: string
  accountId: string
  filename: string
  status: ImportBatch['status']
  rawFile: Buffer | null
  rowsRead: number
  rowsCreated: number
  rowsDuplicate: number
  rowsMerged: number
  validatedAt: Date | null
  cancelledAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type ImportBatchCreationAttributes = Optional<
  ImportBatchAttributes,
  | 'id'
  | 'rawFile'
  | 'rowsRead'
  | 'rowsCreated'
  | 'rowsDuplicate'
  | 'rowsMerged'
  | 'validatedAt'
  | 'cancelledAt'
  | 'createdAt'
  | 'updatedAt'
>

export type ImportBatchModel = Model<
  ImportBatchAttributes,
  ImportBatchCreationAttributes
> &
  ImportBatchAttributes

export type ImportRowAttributes = {
  id: string
  batchId: string
  rowIndex: number
  raw: unknown
  date: string | null
  amountCents: number | null
  bankLabel: string | null
  dedupHash: string | null
  error: ImportLineError | null
  duplicate: boolean
  proposedRuleId: string | null
  proposedCategoryId: string | null
  proposedTransferAccountId: string | null
  proposedScheduleId: string | null
  proposedOriginalDate: string | null
  proposedTagIds: string[]
  candidates: unknown
  createdAt: Date
  updatedAt: Date
}

export type ImportRowCreationAttributes = Optional<
  ImportRowAttributes,
  | 'id'
  | 'date'
  | 'amountCents'
  | 'bankLabel'
  | 'dedupHash'
  | 'error'
  | 'duplicate'
  | 'proposedRuleId'
  | 'proposedCategoryId'
  | 'proposedTransferAccountId'
  | 'proposedScheduleId'
  | 'proposedOriginalDate'
  | 'proposedTagIds'
  | 'candidates'
  | 'createdAt'
  | 'updatedAt'
>

export type ImportRowModel = Model<
  ImportRowAttributes,
  ImportRowCreationAttributes
> &
  ImportRowAttributes

export type CategorizationRuleAttributes = {
  id: string
  userId: string
  priority: number
  matchType: RuleMatchType
  pattern: string
  accountId: string | null
  sign: RuleSign
  amountMinCents: number | null
  amountMaxCents: number | null
  actionCategoryId: string | null
  actionTransferAccountId: string | null
  actionTagIds: string[]
  active: boolean
  createdAt: Date
  updatedAt: Date
}

export type CategorizationRuleCreationAttributes = Optional<
  CategorizationRuleAttributes,
  | 'id'
  | 'accountId'
  | 'amountMinCents'
  | 'amountMaxCents'
  | 'actionCategoryId'
  | 'actionTransferAccountId'
  | 'actionTagIds'
  | 'active'
  | 'createdAt'
  | 'updatedAt'
>

export type CategorizationRuleModel = Model<
  CategorizationRuleAttributes,
  CategorizationRuleCreationAttributes
> &
  CategorizationRuleAttributes

export type AccountStatementAttributes = {
  id: string
  userId: string
  accountId: string
  date: string
  balanceCents: number
  adjustmentTransactionId: string | null
  createdAt: Date
  updatedAt: Date
}

export type AccountStatementCreationAttributes = Optional<
  AccountStatementAttributes,
  'id' | 'adjustmentTransactionId' | 'createdAt' | 'updatedAt'
>

export type AccountStatementModel = Model<
  AccountStatementAttributes,
  AccountStatementCreationAttributes
> &
  AccountStatementAttributes

export type TagAttributes = {
  id: string
  userId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export type TagCreationAttributes = Optional<
  TagAttributes,
  'id' | 'createdAt' | 'updatedAt'
>

export type TagModel = Model<TagAttributes, TagCreationAttributes> &
  TagAttributes

export type TransactionTagAttributes = {
  transactionId: string
  tagId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export type TransactionTagCreationAttributes = Optional<
  TransactionTagAttributes,
  'createdAt' | 'updatedAt'
>

export type TransactionTagModel = Model<
  TransactionTagAttributes,
  TransactionTagCreationAttributes
> &
  TransactionTagAttributes

export type ScheduleTagAttributes = {
  scheduleId: string
  tagId: string
  userId: string
  createdAt: Date
  updatedAt: Date
}

export type ScheduleTagCreationAttributes = Optional<
  ScheduleTagAttributes,
  'createdAt' | 'updatedAt'
>

export type ScheduleTagModel = Model<
  ScheduleTagAttributes,
  ScheduleTagCreationAttributes
> &
  ScheduleTagAttributes

export type ValuationAttributes = {
  id: string
  userId: string
  accountId: string
  date: string
  valueCents: number
  createdAt: Date
  updatedAt: Date
}

export type ValuationCreationAttributes = Optional<
  ValuationAttributes,
  'id' | 'createdAt' | 'updatedAt'
>

export type ValuationModel = Model<
  ValuationAttributes,
  ValuationCreationAttributes
> &
  ValuationAttributes

export type InterestRateAttributes = {
  id: string
  userId: string
  accountId: string
  effectiveDate: string
  annualRate: number
  createdAt: Date
  updatedAt: Date
}

export type InterestRateCreationAttributes = Optional<
  InterestRateAttributes,
  'id' | 'createdAt' | 'updatedAt'
>

export type InterestRateModel = Model<
  InterestRateAttributes,
  InterestRateCreationAttributes
> &
  InterestRateAttributes

export type RegulatedCapAttributes = {
  id: string
  product: RegulatedProduct
  capCents: number
  updatedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export type RegulatedCapCreationAttributes = Optional<
  RegulatedCapAttributes,
  'id' | 'updatedBy' | 'createdAt' | 'updatedAt'
>

export type RegulatedCapModel = Model<
  RegulatedCapAttributes,
  RegulatedCapCreationAttributes
> &
  RegulatedCapAttributes

export type NotificationAttributes = {
  id: string
  userId: string
  type: NotificationType
  payload: unknown
  dedupKey: string
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type NotificationCreationAttributes = Optional<
  NotificationAttributes,
  'id' | 'readAt' | 'createdAt' | 'updatedAt'
>

export type NotificationModel = Model<
  NotificationAttributes,
  NotificationCreationAttributes
> &
  NotificationAttributes

export type AlertEpisodeAttributes = {
  id: string
  userId: string
  accountId: string
  openedAt: Date
  closedAt: Date | null
  minCents: number
  minDate: string
  lastNotifiedMinCents: number
  createdAt: Date
  updatedAt: Date
}

export type AlertEpisodeCreationAttributes = Optional<
  AlertEpisodeAttributes,
  'id' | 'closedAt' | 'createdAt' | 'updatedAt'
>

export type AlertEpisodeModel = Model<
  AlertEpisodeAttributes,
  AlertEpisodeCreationAttributes
> &
  AlertEpisodeAttributes

export type PushSubscriptionAttributes = {
  id: string
  userId: string
  endpoint: string
  p256dh: string
  auth: string
  userAgent: string | null
  lastSuccessAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type PushSubscriptionCreationAttributes = Optional<
  PushSubscriptionAttributes,
  'id' | 'userAgent' | 'lastSuccessAt' | 'createdAt' | 'updatedAt'
>

export type PushSubscriptionModel = Model<
  PushSubscriptionAttributes,
  PushSubscriptionCreationAttributes
> &
  PushSubscriptionAttributes

export type NotificationPreferenceAttributes = {
  userId: string
  type: 'low_balance' | 'manual_reminder'
  push: boolean
  createdAt: Date
  updatedAt: Date
}

export type NotificationPreferenceCreationAttributes = Optional<
  NotificationPreferenceAttributes,
  'createdAt' | 'updatedAt'
>

export type NotificationPreferenceModel = Model<
  NotificationPreferenceAttributes,
  NotificationPreferenceCreationAttributes
> &
  NotificationPreferenceAttributes

export type WebauthnCredentialAttributes = {
  id: string
  userId: string
  credentialId: string
  publicKey: Buffer
  signCount: number
  transports: string[]
  name: string
  lastUsedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export type WebauthnCredentialCreationAttributes = Optional<
  WebauthnCredentialAttributes,
  'id' | 'signCount' | 'transports' | 'lastUsedAt' | 'createdAt' | 'updatedAt'
>

export type WebauthnCredentialModel = Model<
  WebauthnCredentialAttributes,
  WebauthnCredentialCreationAttributes
> &
  WebauthnCredentialAttributes
