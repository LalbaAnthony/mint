import { HttpError } from '../http/http-error.js'
import type { AppDependencies } from '../types/app.js'
import type { UserModel } from '../types/models.js'
import {
  accountKey,
  ensureAccountAllowed,
  recordAccountFailure,
} from './guards.js'
import { verifyPassword } from './passwords.js'

export async function confirmCurrentPassword(
  app: AppDependencies,
  user: UserModel,
  password: string,
): Promise<void> {
  ensureAccountAllowed(app, user.email)
  if (!(await verifyPassword(user.passwordHash, password))) {
    recordAccountFailure(app, user.email)
    throw new HttpError({ status: 400, code: 'invalid_credentials' })
  }
  app.limiters.account.reset(accountKey(user.email))
}
