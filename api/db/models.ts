import { DataTypes } from 'sequelize'
import type { Sequelize } from 'sequelize'
import type {
  CategoryModel,
  EmailChangeTokenModel,
  InvitationModel,
  Models,
  PasswordResetTokenModel,
  SessionModel,
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

  return {
    User,
    Session,
    Invitation,
    PasswordResetToken,
    EmailChangeToken,
    Category,
  }
}
