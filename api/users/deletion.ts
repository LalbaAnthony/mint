import { Op } from 'sequelize'
import { HttpError } from '../http/http-error.js'
import type { AppDependencies } from '../types/app.js'
import type { UserModel } from '../types/models.js'

export async function ensureNotLastAdministrator(
  app: AppDependencies,
  user: UserModel,
): Promise<void> {
  if (user.role !== 'admin') {
    return
  }
  const otherActiveAdministrators = await app.models.User.count({
    where: { role: 'admin', status: 'active', id: { [Op.ne]: user.id } },
  })
  if (otherActiveAdministrators === 0) {
    throw new HttpError({ status: 409, code: 'last_admin' })
  }
}

export async function deleteUserAccount(
  app: AppDependencies,
  user: UserModel,
): Promise<void> {
  await app.sequelize.transaction(async (transaction) => {
    await app.models.Invitation.destroy({
      where: { email: user.email },
      transaction,
    })
    await user.destroy({ transaction })
  })
}
