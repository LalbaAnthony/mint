import { Op, QueryTypes, UniqueConstraintError } from 'sequelize'
import type { Transaction } from 'sequelize'
import type { Tag } from '@mint/shared/types/tags'
import { conflict, notFound } from '../http/http-error.js'
import { tagUsageRowsSchema } from '../schemas/tags.js'
import type { TagModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'

export async function listTags(
  data: DataAccess,
  userId: string,
  transaction?: Transaction,
): Promise<Tag[]> {
  const rows = await data.sequelize.query(
    `SELECT tags.id, tags.name::text AS name,
        (SELECT count(DISTINCT coalesce(t.transfer_group_id, t.id))
           FROM transaction_tags tt
           JOIN transactions t ON t.id = tt.transaction_id
          WHERE tt.tag_id = tags.id) AS "operationCount",
        (SELECT count(*) FROM schedule_tags st
          WHERE st.tag_id = tags.id) AS "scheduleCount",
        (SELECT count(*) FROM categorization_rules r
          WHERE r.user_id = tags.user_id
            AND tags.id = ANY (r.action_tag_ids)) AS "ruleCount"
     FROM tags
     WHERE tags.user_id = :userId
     ORDER BY tags.name, tags.id`,
    { replacements: { userId }, type: QueryTypes.SELECT, transaction },
  )
  return tagUsageRowsSchema.parse(rows)
}

export async function tagById(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<Tag> {
  const tag = (await listTags(data, userId, transaction)).find(
    (candidate) => candidate.id === id,
  )
  if (tag === undefined) {
    throw notFound()
  }
  return tag
}

export async function findUserTag(
  data: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<TagModel> {
  const tag = await data.models.Tag.findOne({
    where: { id, userId },
    transaction,
  })
  if (tag === null) {
    throw notFound()
  }
  return tag
}

export async function findTagByName(
  data: DataAccess,
  userId: string,
  name: string,
  transaction?: Transaction,
): Promise<TagModel | null> {
  return data.models.Tag.findOne({ where: { userId, name }, transaction })
}

export async function withUniqueTagName<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw conflict('tag_name_taken')
    }
    throw error
  }
}

export async function ensureUserTags(
  data: DataAccess,
  userId: string,
  tagIds: readonly string[],
  transaction?: Transaction,
): Promise<void> {
  if (tagIds.length === 0) {
    return
  }
  const found = await data.models.Tag.count({
    where: { userId, id: { [Op.in]: [...tagIds] } },
    transaction,
  })
  if (found !== new Set(tagIds).size) {
    throw notFound()
  }
}

export async function tagIdsByOperation(
  data: DataAccess,
  operationIds: readonly string[],
  transaction?: Transaction,
): Promise<Map<string, string[]>> {
  const byOperation = new Map<string, string[]>()
  if (operationIds.length === 0) {
    return byOperation
  }
  const links = await data.models.TransactionTag.findAll({
    where: { transactionId: { [Op.in]: [...operationIds] } },
    order: [
      ['transactionId', 'ASC'],
      ['tagId', 'ASC'],
    ],
    transaction,
  })
  for (const link of links) {
    byOperation.set(link.transactionId, [
      ...(byOperation.get(link.transactionId) ?? []),
      link.tagId,
    ])
  }
  return byOperation
}

export async function operationTagIds(
  data: DataAccess,
  operationId: string,
  transaction?: Transaction,
): Promise<string[]> {
  return (
    (await tagIdsByOperation(data, [operationId], transaction)).get(
      operationId,
    ) ?? []
  )
}

export async function tagIdsBySchedule(
  data: DataAccess,
  scheduleIds: readonly string[],
  transaction?: Transaction,
): Promise<Map<string, string[]>> {
  const bySchedule = new Map<string, string[]>()
  if (scheduleIds.length === 0) {
    return bySchedule
  }
  const links = await data.models.ScheduleTag.findAll({
    where: { scheduleId: { [Op.in]: [...scheduleIds] } },
    order: [
      ['scheduleId', 'ASC'],
      ['tagId', 'ASC'],
    ],
    transaction,
  })
  for (const link of links) {
    bySchedule.set(link.scheduleId, [
      ...(bySchedule.get(link.scheduleId) ?? []),
      link.tagId,
    ])
  }
  return bySchedule
}

export async function addOperationTags(
  data: DataAccess,
  userId: string,
  operationIds: readonly string[],
  tagIds: readonly string[],
  transaction: Transaction,
): Promise<void> {
  if (operationIds.length === 0 || tagIds.length === 0) {
    return
  }
  await data.models.TransactionTag.bulkCreate(
    operationIds.flatMap((transactionId) =>
      tagIds.map((tagId) => ({ transactionId, tagId, userId })),
    ),
    { transaction, ignoreDuplicates: true },
  )
}

export async function replaceOperationTags(
  data: DataAccess,
  userId: string,
  operationIds: readonly string[],
  tagIds: readonly string[],
  transaction: Transaction,
): Promise<void> {
  if (operationIds.length === 0) {
    return
  }
  await data.models.TransactionTag.destroy({
    where: { transactionId: { [Op.in]: [...operationIds] } },
    transaction,
  })
  await addOperationTags(data, userId, operationIds, tagIds, transaction)
}

export async function replaceScheduleTags(
  data: DataAccess,
  userId: string,
  scheduleId: string,
  tagIds: readonly string[],
  transaction: Transaction,
): Promise<void> {
  await data.models.ScheduleTag.destroy({
    where: { scheduleId },
    transaction,
  })
  if (tagIds.length === 0) {
    return
  }
  await data.models.ScheduleTag.bulkCreate(
    tagIds.map((tagId) => ({ scheduleId, tagId, userId })),
    { transaction },
  )
}

export function unionOf(...lists: readonly (readonly string[])[]): string[] {
  return [...new Set(lists.flat())].sort()
}

export async function deleteTag(
  data: DataAccess,
  tag: TagModel,
  transaction: Transaction,
): Promise<void> {
  await data.sequelize.query(
    `UPDATE categorization_rules
        SET action_tag_ids = array_remove(action_tag_ids, CAST(:tagId AS uuid)),
            updated_at = now()
      WHERE user_id = :userId
        AND CAST(:tagId AS uuid) = ANY (action_tag_ids)`,
    {
      replacements: { tagId: tag.id, userId: tag.userId },
      type: QueryTypes.UPDATE,
      transaction,
    },
  )
  await data.sequelize.query(
    `UPDATE import_rows
        SET proposed_tag_ids = array_remove(proposed_tag_ids, CAST(:tagId AS uuid)),
            updated_at = now()
      WHERE CAST(:tagId AS uuid) = ANY (proposed_tag_ids)
        AND batch_id IN (SELECT id FROM import_batches WHERE user_id = :userId)`,
    {
      replacements: { tagId: tag.id, userId: tag.userId },
      type: QueryTypes.UPDATE,
      transaction,
    },
  )
  await tag.destroy({ transaction })
}
