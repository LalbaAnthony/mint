import { DataTypes } from 'sequelize'
import type { Sequelize } from 'sequelize'
import type {
  AccountModel,
  CategoryModel,
  EmailChangeTokenModel,
  EnvelopeCategoryModel,
  EnvelopeModel,
  InvitationModel,
  Models,
  PasswordResetTokenModel,
  PaymentMethodModel,
  ScheduleModel,
  ScheduleOccurrenceModel,
  SessionModel,
  TransactionModel,
  UserModel,
} from '../types/models.js'

const primaryKey = {
  type: DataTypes.UUID,
  primaryKey: true,
  defaultValue: DataTypes.UUIDV4,
}

const timestamps = {
  createdAt: { type: DataTypes.DATE, allowNull: false },
  updatedAt: { type: DataTypes.DATE, allowNull: false },
}

const options = (tableName: string) => ({ tableName, underscored: true })

export function createModels(sequelize: Sequelize): Models {
  const User = sequelize.define<UserModel>(
    'User',
    {
      id: primaryKey,
      email: { type: DataTypes.CITEXT, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.TEXT, allowNull: false },
      role: { type: DataTypes.TEXT, allowNull: false },
      locale: { type: DataTypes.TEXT, allowNull: false },
      status: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'active',
      },
      forecastHorizonMonths: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 3,
      },
      targetNeedsPct: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 50,
      },
      targetWantsPct: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 30,
      },
      targetSavePct: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 20,
      },
      lastLoginAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('users'),
  )

  const Session = sequelize.define<SessionModel>(
    'Session',
    {
      id: primaryKey,
      sid: { type: DataTypes.TEXT, allowNull: false, unique: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      data: { type: DataTypes.JSONB, allowNull: false },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      ip: { type: DataTypes.TEXT, allowNull: true },
      lastSeenAt: { type: DataTypes.DATE, allowNull: false },
      ...timestamps,
    },
    options('sessions'),
  )

  const Invitation = sequelize.define<InvitationModel>(
    'Invitation',
    {
      id: primaryKey,
      email: { type: DataTypes.CITEXT, allowNull: false },
      tokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true },
      invitedBy: { type: DataTypes.UUID, allowNull: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      acceptedAt: { type: DataTypes.DATE, allowNull: true },
      revokedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('invitations'),
  )

  const PasswordResetToken = sequelize.define<PasswordResetTokenModel>(
    'PasswordResetToken',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      tokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('password_reset_tokens'),
  )

  const EmailChangeToken = sequelize.define<EmailChangeTokenModel>(
    'EmailChangeToken',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      newEmail: { type: DataTypes.CITEXT, allowNull: false },
      tokenHash: { type: DataTypes.TEXT, allowNull: false, unique: true },
      expiresAt: { type: DataTypes.DATE, allowNull: false },
      usedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('email_change_tokens'),
  )

  const Category = sequelize.define<CategoryModel>(
    'Category',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      parentId: { type: DataTypes.UUID, allowNull: true },
      kind: { type: DataTypes.TEXT, allowNull: false },
      expenseGroup: { type: DataTypes.TEXT, allowNull: true },
      name: { type: DataTypes.TEXT, allowNull: false },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      archivedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('categories'),
  )

  const Account = sequelize.define<AccountModel>(
    'Account',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.TEXT, allowNull: false },
      nature: { type: DataTypes.TEXT, allowNull: false },
      regulatedProduct: { type: DataTypes.TEXT, allowNull: true },
      usage: { type: DataTypes.TEXT, allowNull: false },
      institution: { type: DataTypes.TEXT, allowNull: true },
      initialBalanceCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: AccountModel) {
          return Number(this.getDataValue('initialBalanceCents'))
        },
      },
      initialBalanceDate: { type: DataTypes.DATEONLY, allowNull: false },
      lowBalanceThresholdCents: {
        type: DataTypes.BIGINT,
        allowNull: true,
        get(this: AccountModel) {
          const stored = this.getDataValue('lowBalanceThresholdCents')
          return stored === null ? null : Number(stored)
        },
      },
      sortOrder: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      archivedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('accounts'),
  )

  const PaymentMethod = sequelize.define<PaymentMethodModel>(
    'PaymentMethod',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      label: { type: DataTypes.TEXT, allowNull: false },
      kind: { type: DataTypes.TEXT, allowNull: false },
      archivedAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('payment_methods'),
  )

  const Schedule = sequelize.define<ScheduleModel>(
    'Schedule',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      kind: { type: DataTypes.TEXT, allowNull: false },
      label: { type: DataTypes.TEXT, allowNull: false },
      amountCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: ScheduleModel) {
          return Number(this.getDataValue('amountCents'))
        },
      },
      paymentMethodId: { type: DataTypes.UUID, allowNull: true },
      accountId: { type: DataTypes.UUID, allowNull: true },
      sourceAccountId: { type: DataTypes.UUID, allowNull: true },
      targetAccountId: { type: DataTypes.UUID, allowNull: true },
      categoryId: { type: DataTypes.UUID, allowNull: true },
      isSubscription: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      triggerMode: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'auto',
      },
      frequency: { type: DataTypes.TEXT, allowNull: false },
      interval: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      startDate: { type: DataTypes.DATEONLY, allowNull: false },
      anchorLastDay: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      endDate: { type: DataTypes.DATEONLY, allowNull: true },
      maxOccurrences: { type: DataTypes.INTEGER, allowNull: true },
      businessDayRule: {
        type: DataTypes.TEXT,
        allowNull: false,
        defaultValue: 'exact',
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    },
    options('schedules'),
  )

  const ScheduleOccurrence = sequelize.define<ScheduleOccurrenceModel>(
    'ScheduleOccurrence',
    {
      id: primaryKey,
      scheduleId: { type: DataTypes.UUID, allowNull: false },
      originalDate: { type: DataTypes.DATEONLY, allowNull: false },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: true },
      amountCents: {
        type: DataTypes.BIGINT,
        allowNull: true,
        get(this: ScheduleOccurrenceModel) {
          const stored = this.getDataValue('amountCents')
          return stored === null ? null : Number(stored)
        },
      },
      state: { type: DataTypes.TEXT, allowNull: false },
      ...timestamps,
    },
    options('schedule_occurrences'),
  )

  const Transaction = sequelize.define<TransactionModel>(
    'Transaction',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      paymentMethodId: { type: DataTypes.UUID, allowNull: true },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      amountCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: TransactionModel) {
          return Number(this.getDataValue('amountCents'))
        },
      },
      label: { type: DataTypes.TEXT, allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      categoryId: { type: DataTypes.UUID, allowNull: true },
      status: { type: DataTypes.TEXT, allowNull: false },
      origin: { type: DataTypes.TEXT, allowNull: false },
      transferGroupId: { type: DataTypes.UUID, allowNull: true },
      occurrenceId: { type: DataTypes.UUID, allowNull: true },
      ...timestamps,
    },
    options('transactions'),
  )

  const Envelope = sequelize.define<EnvelopeModel>(
    'Envelope',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      label: { type: DataTypes.TEXT, allowNull: false },
      monthlyAmountCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: EnvelopeModel) {
          return Number(this.getDataValue('monthlyAmountCents'))
        },
      },
      paymentMethodId: { type: DataTypes.UUID, allowNull: true },
      accountId: { type: DataTypes.UUID, allowNull: true },
      carryOver: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    },
    options('envelopes'),
  )

  const EnvelopeCategory = sequelize.define<EnvelopeCategoryModel>(
    'EnvelopeCategory',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      envelopeId: { type: DataTypes.UUID, allowNull: false },
      categoryId: { type: DataTypes.UUID, allowNull: false },
      ...timestamps,
    },
    options('envelope_categories'),
  )

  return {
    User,
    Session,
    Invitation,
    PasswordResetToken,
    EmailChangeToken,
    Category,
    Account,
    PaymentMethod,
    Schedule,
    ScheduleOccurrence,
    Transaction,
    Envelope,
    EnvelopeCategory,
  }
}
