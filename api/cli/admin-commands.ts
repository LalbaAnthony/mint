import { UniqueConstraintError } from 'sequelize'
import type { Locale } from '@mint/shared/types/user'
import { audit } from '../audit.js'
import type { CliDatabase, PromotionResult } from '../types/cli.js'
import type { UserModel } from '../types/models.js'
import { createUserWithDefaults } from '../users/users.js'

export async function createAdministrator(
  { sequelize, models }: CliDatabase,
  input: { email: string; locale: Locale; passwordHash: string },
): Promise<UserModel> {
  try {
    const user = await sequelize.transaction((transaction) =>
      createUserWithDefaults(models, { ...input, role: 'admin' }, transaction),
    )
    audit('admin_created', { userId: user.id, source: 'cli' })
    return user
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw new Error(
        `A user already uses ${input.email}: run the promote command instead`,
        { cause: error },
      )
    }
    throw error
  }
}

export async function promoteToAdministrator(
  { models }: CliDatabase,
  email: string,
): Promise<PromotionResult> {
  const user = await models.User.findOne({ where: { email } })
  if (user === null) {
    throw new Error(`No user uses ${email}`)
  }
  if (user.role === 'admin') {
    return 'already_admin'
  }
  await user.update({ role: 'admin' })
  audit('admin_promoted', { userId: user.id, source: 'cli' })
  return 'promoted'
}
