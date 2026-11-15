import { DataTypes } from 'sequelize'
import type { Model, Sequelize } from 'sequelize'
import type {
  AccountModel,
  AccountStatementModel,
  CategorizationRuleModel,
  ImportBatchModel,
  ImportMappingModel,
  ImportRowModel,
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
  ScheduleTagModel,
  SessionModel,
  TagModel,
  TransactionModel,
  TransactionTagModel,
  UserModel,
  ValuationModel,
  InterestRateModel,
  RegulatedCapModel,
  NotificationModel,
  AlertEpisodeModel,
  PushSubscriptionModel,
  NotificationPreferenceModel,
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
      depositCapCents: {
        type: DataTypes.BIGINT,
        allowNull: true,
        get(this: AccountModel) {
          const stored = this.getDataValue('depositCapCents')
          return stored === null ? null : Number(stored)
        },
      },
      capitalizedInterestCents: {
        type: DataTypes.BIGINT,
        allowNull: true,
        get(this: AccountModel) {
          const stored = this.getDataValue('capitalizedInterestCents')
          return stored === null ? null : Number(stored)
        },
      },
      interestMethod: { type: DataTypes.TEXT, allowNull: true },
      capitalization: { type: DataTypes.TEXT, allowNull: true },
      anniversaryDate: { type: DataTypes.DATEONLY, allowNull: true },
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
      note: { type: DataTypes.TEXT, allowNull: true },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      amountTolerancePct: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 10,
      },
      bankLabelPatterns: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: false,
        defaultValue: [],
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      reminderDaysBefore: {
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 2,
      },
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
      bankLabel: { type: DataTypes.TEXT, allowNull: true },
      importBatchId: { type: DataTypes.UUID, allowNull: true },
      dedupHash: { type: DataTypes.TEXT, allowNull: true },
      preMergeSnapshot: { type: DataTypes.JSONB, allowNull: true },
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

  const bigintCents = <T extends Model>(field: string) => ({
    type: DataTypes.BIGINT,
    allowNull: true,
    get(this: T) {
      const stored: unknown = this.getDataValue(field)
      return stored === null || stored === undefined ? null : Number(stored)
    },
  })

  const ImportMapping = sequelize.define<ImportMappingModel>(
    'ImportMapping',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      delimiter: { type: DataTypes.TEXT, allowNull: false },
      encoding: { type: DataTypes.TEXT, allowNull: false },
      hasHeader: { type: DataTypes.BOOLEAN, allowNull: false },
      skipTop: { type: DataTypes.SMALLINT, allowNull: false },
      skipBottom: { type: DataTypes.SMALLINT, allowNull: false },
      dateFormat: { type: DataTypes.TEXT, allowNull: false },
      decimalSeparator: { type: DataTypes.TEXT, allowNull: false },
      colDate: { type: DataTypes.SMALLINT, allowNull: false },
      colLabel: { type: DataTypes.SMALLINT, allowNull: false },
      colAmount: { type: DataTypes.SMALLINT, allowNull: true },
      colDebit: { type: DataTypes.SMALLINT, allowNull: true },
      colCredit: { type: DataTypes.SMALLINT, allowNull: true },
      ...timestamps,
    },
    options('import_mappings'),
  )

  const ImportBatch = sequelize.define<ImportBatchModel>(
    'ImportBatch',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      filename: { type: DataTypes.TEXT, allowNull: false },
      status: { type: DataTypes.TEXT, allowNull: false },
      rawFile: { type: DataTypes.BLOB, allowNull: true },
      rowsRead: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      rowsCreated: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rowsDuplicate: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      rowsMerged: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      validatedAt: { type: DataTypes.DATE, allowNull: true },
      cancelledAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('import_batches'),
  )

  const ImportRow = sequelize.define<ImportRowModel>(
    'ImportRow',
    {
      id: primaryKey,
      batchId: { type: DataTypes.UUID, allowNull: false },
      rowIndex: { type: DataTypes.INTEGER, allowNull: false },
      raw: { type: DataTypes.JSONB, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: true },
      amountCents: bigintCents<ImportRowModel>('amountCents'),
      bankLabel: { type: DataTypes.TEXT, allowNull: true },
      dedupHash: { type: DataTypes.TEXT, allowNull: true },
      error: { type: DataTypes.TEXT, allowNull: true },
      duplicate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      proposedRuleId: { type: DataTypes.UUID, allowNull: true },
      proposedCategoryId: { type: DataTypes.UUID, allowNull: true },
      proposedTransferAccountId: { type: DataTypes.UUID, allowNull: true },
      proposedScheduleId: { type: DataTypes.UUID, allowNull: true },
      proposedOriginalDate: { type: DataTypes.DATEONLY, allowNull: true },
      proposedTagIds: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      candidates: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
      ...timestamps,
    },
    options('import_rows'),
  )

  const CategorizationRule = sequelize.define<CategorizationRuleModel>(
    'CategorizationRule',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      priority: { type: DataTypes.INTEGER, allowNull: false },
      matchType: { type: DataTypes.TEXT, allowNull: false },
      pattern: { type: DataTypes.TEXT, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: true },
      sign: { type: DataTypes.TEXT, allowNull: false },
      amountMinCents: bigintCents<CategorizationRuleModel>('amountMinCents'),
      amountMaxCents: bigintCents<CategorizationRuleModel>('amountMaxCents'),
      actionCategoryId: { type: DataTypes.UUID, allowNull: true },
      actionTransferAccountId: { type: DataTypes.UUID, allowNull: true },
      actionTagIds: {
        type: DataTypes.ARRAY(DataTypes.UUID),
        allowNull: false,
        defaultValue: [],
      },
      active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    },
    options('categorization_rules'),
  )

  const AccountStatement = sequelize.define<AccountStatementModel>(
    'AccountStatement',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      balanceCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: AccountStatementModel) {
          return Number(this.getDataValue('balanceCents'))
        },
      },
      adjustmentTransactionId: { type: DataTypes.UUID, allowNull: true },
      ...timestamps,
    },
    options('account_statements'),
  )

  const Tag = sequelize.define<TagModel>(
    'Tag',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      name: { type: DataTypes.CITEXT, allowNull: false },
      ...timestamps,
    },
    options('tags'),
  )

  const TransactionTag = sequelize.define<TransactionTagModel>(
    'TransactionTag',
    {
      transactionId: {
        type: DataTypes.UUID,
        allowNull: false,
        primaryKey: true,
      },
      tagId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      ...timestamps,
    },
    options('transaction_tags'),
  )

  const ScheduleTag = sequelize.define<ScheduleTagModel>(
    'ScheduleTag',
    {
      scheduleId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      tagId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      userId: { type: DataTypes.UUID, allowNull: false },
      ...timestamps,
    },
    options('schedule_tags'),
  )

  const Valuation = sequelize.define<ValuationModel>(
    'Valuation',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      date: { type: DataTypes.DATEONLY, allowNull: false },
      valueCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: ValuationModel) {
          return Number(this.getDataValue('valueCents'))
        },
      },
      ...timestamps,
    },
    options('valuations'),
  )

  const InterestRate = sequelize.define<InterestRateModel>(
    'InterestRate',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      effectiveDate: { type: DataTypes.DATEONLY, allowNull: false },
      annualRate: {
        type: DataTypes.DECIMAL(6, 4),
        allowNull: false,
        get(this: InterestRateModel) {
          return Number(this.getDataValue('annualRate'))
        },
      },
      ...timestamps,
    },
    options('interest_rates'),
  )

  const RegulatedCap = sequelize.define<RegulatedCapModel>(
    'RegulatedCap',
    {
      id: primaryKey,
      product: { type: DataTypes.TEXT, allowNull: false },
      capCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: RegulatedCapModel) {
          return Number(this.getDataValue('capCents'))
        },
      },
      updatedBy: { type: DataTypes.UUID, allowNull: true },
      ...timestamps,
    },
    options('regulated_caps'),
  )

  const Notification = sequelize.define<NotificationModel>(
    'Notification',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      type: { type: DataTypes.TEXT, allowNull: false },
      payload: { type: DataTypes.JSONB, allowNull: false },
      dedupKey: { type: DataTypes.TEXT, allowNull: false },
      readAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('notifications'),
  )

  const AlertEpisode = sequelize.define<AlertEpisodeModel>(
    'AlertEpisode',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      accountId: { type: DataTypes.UUID, allowNull: false },
      openedAt: { type: DataTypes.DATE, allowNull: false },
      closedAt: { type: DataTypes.DATE, allowNull: true },
      minCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: AlertEpisodeModel) {
          return Number(this.getDataValue('minCents'))
        },
      },
      minDate: { type: DataTypes.DATEONLY, allowNull: false },
      lastNotifiedMinCents: {
        type: DataTypes.BIGINT,
        allowNull: false,
        get(this: AlertEpisodeModel) {
          return Number(this.getDataValue('lastNotifiedMinCents'))
        },
      },
      ...timestamps,
    },
    options('alert_episodes'),
  )

  const PushSubscription = sequelize.define<PushSubscriptionModel>(
    'PushSubscription',
    {
      id: primaryKey,
      userId: { type: DataTypes.UUID, allowNull: false },
      endpoint: { type: DataTypes.TEXT, allowNull: false, unique: true },
      p256dh: { type: DataTypes.TEXT, allowNull: false },
      auth: { type: DataTypes.TEXT, allowNull: false },
      userAgent: { type: DataTypes.TEXT, allowNull: true },
      lastSuccessAt: { type: DataTypes.DATE, allowNull: true },
      ...timestamps,
    },
    options('push_subscriptions'),
  )

  const NotificationPreference = sequelize.define<NotificationPreferenceModel>(
    'NotificationPreference',
    {
      userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
      type: { type: DataTypes.TEXT, allowNull: false, primaryKey: true },
      push: { type: DataTypes.BOOLEAN, allowNull: false },
      ...timestamps,
    },
    options('notification_preferences'),
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
    ImportMapping,
    ImportBatch,
    ImportRow,
    CategorizationRule,
    AccountStatement,
    Tag,
    TransactionTag,
    ScheduleTag,
    Valuation,
    InterestRate,
    RegulatedCap,
    Notification,
    AlertEpisode,
    PushSubscription,
    NotificationPreference,
  }
}
