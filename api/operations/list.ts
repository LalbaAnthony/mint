import { Op, Sequelize } from 'sequelize'
import type { Order, WhereOptions } from 'sequelize'
import type {
  OperationGroup,
  OperationListQuery,
  OperationListResponse,
} from '@mint/shared/types/operations'
import type { CategoryModel, TransactionAttributes } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import { toOperations } from './operations.js'

export function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (character) => `\\${character}`)
}

function rootGroup(
  category: CategoryModel,
  byId: ReadonlyMap<string, CategoryModel>,
): string | null {
  const root =
    category.parentId === null ? category : byId.get(category.parentId)
  return root?.expenseGroup ?? null
}

function savingsTransferGroups(data: DataAccess, userId: string) {
  return Sequelize.literal(`(
    SELECT debit.transfer_group_id
    FROM transactions debit
    JOIN accounts debit_account ON debit_account.id = debit.account_id
    JOIN transactions credit
      ON credit.transfer_group_id = debit.transfer_group_id
      AND credit.amount_cents > 0
    JOIN accounts credit_account ON credit_account.id = credit.account_id
    WHERE debit.user_id = ${data.sequelize.escape(userId)}
      AND debit.amount_cents < 0
      AND debit_account.usage = 'current'
      AND credit_account.usage IN ('emergency', 'savings', 'investment')
  )`)
}

async function groupConditions(
  data: DataAccess,
  userId: string,
  groups: readonly OperationGroup[],
  categories: readonly CategoryModel[],
): Promise<WhereOptions<TransactionAttributes>[]> {
  const byId = new Map(categories.map((category) => [category.id, category]))
  return groups.map((group) => {
    if (group === 'save') {
      return {
        transferGroupId: { [Op.in]: savingsTransferGroups(data, userId) },
      }
    }
    const ids = categories
      .filter(
        (category) =>
          category.kind === 'expense' && rootGroup(category, byId) === group,
      )
      .map((category) => category.id)
    return { categoryId: { [Op.in]: ids } }
  })
}

function withDescendants(
  ids: readonly string[],
  categories: readonly CategoryModel[],
): string[] {
  return categories
    .filter(
      (category) =>
        ids.includes(category.id) ||
        (category.parentId !== null && ids.includes(category.parentId)),
    )
    .map((category) => category.id)
}

function absoluteAmount() {
  return Sequelize.fn('abs', Sequelize.col('amount_cents'))
}

function orderOf(query: OperationListQuery): Order {
  const direction = query.order === 'asc' ? 'ASC' : 'DESC'
  return query.sort === 'amount'
    ? [
        [absoluteAmount(), direction],
        ['date', 'DESC'],
        ['id', 'ASC'],
      ]
    : [
        ['date', direction],
        ['createdAt', direction],
        ['id', direction],
      ]
}

export async function listOperations(
  data: DataAccess,
  userId: string,
  query: OperationListQuery,
): Promise<OperationListResponse> {
  const conditions: WhereOptions<TransactionAttributes>[] = [{ userId }]
  if (query.from !== undefined) {
    conditions.push({ date: { [Op.gte]: query.from } })
  }
  if (query.to !== undefined) {
    conditions.push({ date: { [Op.lte]: query.to } })
  }
  if (query.accountIds !== undefined) {
    conditions.push({ accountId: { [Op.in]: query.accountIds } })
  }
  if (query.q !== undefined && query.q !== '') {
    const pattern = `%${escapeLike(query.q)}%`
    conditions.push({
      [Op.or]: [
        { label: { [Op.iLike]: pattern } },
        { bankLabel: { [Op.iLike]: pattern } },
        { note: { [Op.iLike]: pattern } },
      ],
    })
  }
  if (query.categoryIds !== undefined || query.groups !== undefined) {
    const categories = await data.models.Category.findAll({ where: { userId } })
    if (query.categoryIds !== undefined) {
      conditions.push({
        categoryId: {
          [Op.in]: withDescendants(query.categoryIds, categories),
        },
      })
    }
    if (query.groups !== undefined) {
      conditions.push({
        [Op.or]: await groupConditions(data, userId, query.groups, categories),
      })
    }
  }
  if (query.tagIds !== undefined) {
    const tagIds = query.tagIds.map((id) => data.sequelize.escape(id))
    conditions.push({
      id: {
        [Op.in]: Sequelize.literal(
          `(SELECT tt.transaction_id FROM transaction_tags tt
            WHERE tt.user_id = ${data.sequelize.escape(userId)}
              AND tt.tag_id IN (${tagIds.length === 0 ? 'NULL' : tagIds.join(', ')}))`,
        ),
      },
    })
  }
  if (query.minCents !== undefined) {
    conditions.push(
      Sequelize.where(absoluteAmount(), { [Op.gte]: query.minCents }),
    )
  }
  if (query.maxCents !== undefined) {
    conditions.push(
      Sequelize.where(absoluteAmount(), { [Op.lte]: query.maxCents }),
    )
  }
  if (query.direction !== undefined) {
    conditions.push({
      amountCents:
        query.direction === 'debit' ? { [Op.lt]: 0 } : { [Op.gt]: 0 },
    })
  }
  if (query.origins !== undefined) {
    conditions.push({ origin: { [Op.in]: query.origins } })
  }
  if (query.status !== undefined) {
    conditions.push({ status: query.status })
  }
  if (query.reconciled !== undefined) {
    conditions.push(
      query.reconciled
        ? { occurrenceId: { [Op.ne]: null }, origin: { [Op.ne]: 'schedule' } }
        : {
            [Op.or]: [{ occurrenceId: null }, { origin: 'schedule' }],
          },
    )
  }
  if (query.unconfirmed !== undefined) {
    const imported = Sequelize.literal(
      "(SELECT b.account_id FROM import_batches b WHERE b.status = 'validated')",
    )
    conditions.push(
      query.unconfirmed
        ? { origin: 'schedule', accountId: { [Op.in]: imported } }
        : {
            [Op.or]: [
              { origin: { [Op.ne]: 'schedule' } },
              { accountId: { [Op.notIn]: imported } },
            ],
          },
    )
  }
  const { rows, count } = await data.models.Transaction.findAndCountAll({
    where: { [Op.and]: conditions },
    order: orderOf(query),
    limit: query.pageSize,
    offset: (query.page - 1) * query.pageSize,
  })
  return {
    items: await toOperations(data, rows),
    total: count,
    page: query.page,
    pageSize: query.pageSize,
  }
}
