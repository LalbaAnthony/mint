import type { Transaction } from 'sequelize'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import { findUserAccount } from '../accounts/accounts.js'
import { conflict, notFound } from '../http/http-error.js'
import type { AppDependencies } from '../types/app.js'
import type { AccountModel, PaymentMethodModel } from '../types/models.js'

export function toPaymentMethod(
  paymentMethod: PaymentMethodModel,
): PaymentMethod {
  return {
    id: paymentMethod.id,
    label: paymentMethod.label,
    kind: paymentMethod.kind,
    accountId: paymentMethod.accountId,
    archivedAt: paymentMethod.archivedAt?.toISOString() ?? null,
  }
}

export async function findUserPaymentMethod(
  app: AppDependencies,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<PaymentMethodModel> {
  const paymentMethod = await app.models.PaymentMethod.findOne({
    where: { id, userId },
    transaction,
  })
  if (paymentMethod === null) {
    throw notFound()
  }
  return paymentMethod
}

export async function findActiveAccount(
  app: AppDependencies,
  userId: string,
  accountId: string,
  transaction?: Transaction,
): Promise<AccountModel> {
  const account = await findUserAccount(app, userId, accountId, transaction)
  if (account.archivedAt !== null) {
    throw conflict('account_archived')
  }
  return account
}
