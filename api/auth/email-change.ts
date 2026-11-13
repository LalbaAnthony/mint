import { Op } from 'sequelize'
import { HttpError } from '../http/http-error.js'
import { buildLink, emailChangeMessage } from '../mail/messages.js'
import type { AppDependencies } from '../types/app.js'
import type { UserModel } from '../types/models.js'
import { addMilliseconds, generateToken } from './tokens.js'

export const emailChangeValidityMs = 60 * 60 * 1000

export async function issueEmailChange(
  app: AppDependencies,
  user: UserModel,
  newEmail: string,
): Promise<void> {
  const now = app.clock.now()
  const { token, tokenHash } = generateToken()
  await app.sequelize.transaction(async (transaction) => {
    await app.models.EmailChangeToken.destroy({
      where: { userId: user.id, usedAt: { [Op.is]: null } },
      transaction,
    })
    await app.models.EmailChangeToken.create(
      {
        userId: user.id,
        newEmail,
        tokenHash,
        expiresAt: addMilliseconds(now, emailChangeValidityMs),
      },
      { transaction },
    )
    const link = buildLink(app.config.appOrigin, '/confirm-email', token)
    try {
      await app.mailer.send(emailChangeMessage(newEmail, user.locale, link))
    } catch (error) {
      throw new HttpError({ status: 502, code: 'mail_delivery_failed' }, error)
    }
  })
}
