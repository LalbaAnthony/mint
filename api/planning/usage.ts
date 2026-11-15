import { Op, QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import type { UsageCounts } from '@mint/shared/types/operations'
import { accountMovementsRowsSchema } from '../schemas/planning.js'
import type { DataAccess } from '../types/planning.js'

export async function loadAccountBalances(
  data: DataAccess,
  userId: string,
  today: string,
  transaction?: Transaction,
): Promise<Map<string, number>> {
  const rows = await data.sequelize.query(
    `SELECT t.account_id AS "accountId", sum(t.amount_cents) AS "movementsCents"
     FROM transactions t
     JOIN accounts a ON a.id = t.account_id
     WHERE t.user_id = :userId
       AND t.date >= a.initial_balance_date
       AND t.date <= :today
     GROUP BY t.account_id`,
    { replacements: { userId, today }, type: QueryTypes.SELECT, transaction },
  )
  return new Map(
    accountMovementsRowsSchema
      .parse(rows)
      .map((row) => [row.accountId, row.movementsCents]),
  )
}

async function paymentMethodIdsOf(
  data: DataAccess,
  userId: string,
  accountId: string,
  transaction?: Transaction,
): Promise<string[]> {
  const paymentMethods = await data.models.PaymentMethod.findAll({
    attributes: ['id'],
    where: { userId, accountId },
    transaction,
  })
  return paymentMethods.map((paymentMethod) => paymentMethod.id)
}

export async function accountUsage(
  data: DataAccess,
  userId: string,
  accountId: string,
  transaction?: Transaction,
): Promise<UsageCounts> {
  const paymentMethodIds = await paymentMethodIdsOf(
    data,
    userId,
    accountId,
    transaction,
  )
  const throughPaymentMethod =
    paymentMethodIds.length === 0
      ? []
      : [{ paymentMethodId: { [Op.in]: paymentMethodIds } }]
  return {
    operations: await data.models.Transaction.count({
      where: { userId, accountId },
      transaction,
    }),
    schedules: await data.models.Schedule.count({
      where: {
        userId,
        [Op.or]: [
          { accountId },
          { sourceAccountId: accountId },
          { targetAccountId: accountId },
          ...throughPaymentMethod,
        ],
      },
      transaction,
    }),
    envelopes: await data.models.Envelope.count({
      where: { userId, [Op.or]: [{ accountId }, ...throughPaymentMethod] },
      transaction,
    }),
    rules: await data.models.CategorizationRule.count({
      where: {
        userId,
        [Op.or]: [{ accountId }, { actionTransferAccountId: accountId }],
      },
      transaction,
    }),
  }
}

export async function paymentMethodUsage(
  data: DataAccess,
  userId: string,
  paymentMethodId: string,
  transaction?: Transaction,
): Promise<UsageCounts> {
  const where = { userId, paymentMethodId }
  return {
    operations: await data.models.Transaction.count({ where, transaction }),
    schedules: await data.models.Schedule.count({ where, transaction }),
    envelopes: await data.models.Envelope.count({ where, transaction }),
    rules: 0,
  }
}

export async function categoryUsage(
  data: DataAccess,
  userId: string,
  categoryIds: readonly string[],
  transaction?: Transaction,
): Promise<UsageCounts> {
  const where = { userId, categoryId: { [Op.in]: [...categoryIds] } }
  return {
    operations: await data.models.Transaction.count({ where, transaction }),
    schedules: await data.models.Schedule.count({ where, transaction }),
    envelopes: await data.models.EnvelopeCategory.count({ where, transaction }),
    rules: await data.models.CategorizationRule.count({
      where: { userId, actionCategoryId: { [Op.in]: [...categoryIds] } },
      transaction,
    }),
  }
}

export function isUsed(usage: UsageCounts): boolean {
  return usage.operations + usage.schedules + usage.envelopes + usage.rules > 0
}
