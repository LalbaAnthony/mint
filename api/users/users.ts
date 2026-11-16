import type { Transaction } from 'sequelize'
import type { AdminUser } from '@mint/shared/types/admin'
import type { Locale, UserProfile, UserRole } from '@mint/shared/types/user'
import type { Models, UserModel } from '../types/models.js'
import { createDefaultCategories } from './default-categories.js'

export function toUserProfile(user: UserModel): UserProfile {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    locale: user.locale,
    theme: user.theme,
    forecastHorizonMonths: user.forecastHorizonMonths,
    targets: {
      needs: user.targetNeedsPct,
      wants: user.targetWantsPct,
      save: user.targetSavePct,
    },
  }
}

export function toAdminUser(user: UserModel): AdminUser {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    locale: user.locale,
    status: user.status,
    createdAt: user.createdAt.toISOString(),
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
  }
}

export async function createUserWithDefaults(
  models: Models,
  input: {
    email: string
    passwordHash: string
    role: UserRole
    locale: Locale
  },
  transaction: Transaction,
): Promise<UserModel> {
  const user = await models.User.create(input, { transaction })
  await createDefaultCategories(models, user.id, input.locale, transaction)
  return user
}
