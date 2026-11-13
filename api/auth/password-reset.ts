import { Op } from 'sequelize'
import { HttpError } from '../http/http-error.js'
import { buildLink, passwordResetMessage } from '../mail/messages.js'
import type { AppDependencies } from '../types/app.js'
import type { UserModel } from '../types/models.js'
import { addMilliseconds, generateToken } from './tokens.js'

export const passwordResetValidityMs = 60 * 60 * 1000

export async function issuePasswordReset(
  app: AppDependencies,
  user: UserModel,
): Promise<void> {
  const now = app.clock.now()
  const { token, tokenHash } = generateToken()
  await app.sequelize.transaction(async (transaction) => {
    await app.models.PasswordResetToken.destroy({
      where: { userId: user.id, usedAt: { [Op.is]: null } },
      transaction,
    })
    await app.models.PasswordResetToken.create(
      {
        userId: user.id,
        tokenHash,
        expiresAt: addMilliseconds(now, passwordResetValidityMs),
      },
      { transaction },
    )
    const link = buildLink(app.config.appOrigin, '/reset-password', token)
    try {
      await app.mailer.send(passwordResetMessage(user.email, user.locale, link))
    } catch (error) {
      throw new HttpError({ status: 502, code: 'mail_delivery_failed' }, error)
    }
  })
}
