import { QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import type { Statement } from '@mint/shared/types/statements'
import { conflict, notFound } from '../http/http-error.js'
import { statementRowsSchema } from '../schemas/planning.js'
import type { AccountStatementModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'

const calculatedAtStatementDate = `
  a.initial_balance_cents + COALESCE((
    SELECT sum(t.amount_cents) FROM transactions t
    WHERE t.account_id = s.account_id
      AND t.date >= a.initial_balance_date
      AND t.date <= s.date
  ), 0)`

async function statementRows(
  data: DataAccess,
  userId: string,
  filter: string,
  replacements: Record<string, string>,
  transaction?: Transaction,
) {
  const rows = await data.sequelize.query(
    `SELECT ${filter === 'latest' ? 'DISTINCT ON (s.account_id)' : ''}
        s.id, s.account_id AS "accountId", s.date::text AS date,
        s.balance_cents AS "balanceCents",
        s.adjustment_transaction_id AS "adjustmentOperationId",
        ${calculatedAtStatementDate} AS "calculatedBalanceCents"
     FROM account_statements s
     JOIN accounts a ON a.id = s.account_id
     WHERE s.user_id = :userId
       ${filter === 'account' ? 'AND s.account_id = :accountId' : ''}
       ${filter === 'single' ? 'AND s.id = :statementId' : ''}
     ORDER BY ${filter === 'latest' ? 's.account_id, ' : ''}s.date DESC`,
    {
      replacements: { userId, ...replacements },
      type: QueryTypes.SELECT,
      transaction,
    },
  )
  return statementRowsSchema.parse(rows).map((row): Statement => ({
    ...row,
    gapCents: row.balanceCents - row.calculatedBalanceCents,
  }))
}

export function listStatements(
  data: DataAccess,
  userId: string,
  accountId: string,
  transaction?: Transaction,
): Promise<Statement[]> {
  return statementRows(data, userId, 'account', { accountId }, transaction)
}

export async function statementById(
  data: DataAccess,
  userId: string,
  statementId: string,
  transaction?: Transaction,
): Promise<Statement> {
  const [statement] = await statementRows(
    data,
    userId,
    'single',
    { statementId },
    transaction,
  )
  if (statement === undefined) {
    throw notFound()
  }
  return statement
}

export async function loadStatementGaps(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<Map<string, number>> {
  const latest = await statementRows(data, userId, 'latest', {}, transaction)
  return new Map(
    latest.map((statement) => [statement.accountId, statement.gapCents]),
  )
}

export async function findUserStatement(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<AccountStatementModel> {
  const statement = await data.models.AccountStatement.findOne({
    where: { id, userId },
    transaction,
  })
  if (statement === null) {
    throw notFound()
  }
  return statement
}

export async function adjustmentCategoryId(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<string> {
  const category = await data.models.Category.findOne({
    where: { userId, kind: 'adjustment', isSystem: true },
    transaction,
  })
  if (category === null) {
    throw new Error(`User ${userId} has no adjustment category`)
  }
  return category.id
}

export function ensureGap(statement: Statement): void {
  if (statement.gapCents === 0) {
    throw conflict('statement_balanced')
  }
}
