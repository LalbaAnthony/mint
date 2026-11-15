import { Op, UniqueConstraintError } from 'sequelize'
import type { Transaction } from 'sequelize'
import type {
  Category,
  EditableCategoryKind,
} from '@mint/shared/types/categories'
import { conflict, notFound } from '../http/http-error.js'
import type { AppDependencies } from '../types/app.js'
import type { DataAccess } from '../types/planning.js'
import type { CategorySiblingScope } from '../types/categories.js'
import type { CategoryModel } from '../types/models.js'

export function toCategory(
  category: CategoryModel,
  parent: CategoryModel | null,
): Category {
  return {
    id: category.id,
    parentId: category.parentId,
    kind: category.kind,
    expenseGroup: category.expenseGroup ?? parent?.expenseGroup ?? null,
    name: category.name,
    isSystem: category.isSystem,
    sortOrder: category.sortOrder,
    archivedAt: category.archivedAt?.toISOString() ?? null,
  }
}

export async function findUserCategory(
  app: DataAccess,
  userId: string,
  id: string,
  transaction?: Transaction,
): Promise<CategoryModel> {
  const category = await app.models.Category.findOne({
    where: { id, userId },
    transaction,
  })
  if (category === null) {
    throw notFound()
  }
  return category
}

export async function findParentOf(
  app: AppDependencies,
  category: CategoryModel,
  transaction?: Transaction,
): Promise<CategoryModel | null> {
  return category.parentId === null
    ? null
    : findUserCategory(app, category.userId, category.parentId, transaction)
}

export function ensureEditable(category: CategoryModel): void {
  if (category.isSystem) {
    throw conflict('system_category')
  }
  if (category.archivedAt !== null) {
    throw conflict('archived')
  }
}

export async function findAvailableParent(
  app: AppDependencies,
  userId: string,
  parentId: string,
  kind: EditableCategoryKind,
  transaction?: Transaction,
): Promise<CategoryModel> {
  const parent = await findUserCategory(app, userId, parentId, transaction)
  if (parent.parentId !== null || parent.isSystem || parent.kind !== kind) {
    throw conflict('invalid_parent')
  }
  if (parent.archivedAt !== null) {
    throw conflict('parent_archived')
  }
  return parent
}

export function siblingScope(category: CategoryModel): CategorySiblingScope {
  return category.parentId === null
    ? {
        parentId: null,
        kind: category.kind,
        expenseGroup: category.expenseGroup,
      }
    : { parentId: category.parentId, kind: category.kind, expenseGroup: null }
}

export async function findSiblings(
  app: AppDependencies,
  userId: string,
  scope: CategorySiblingScope,
  transaction?: Transaction,
): Promise<CategoryModel[]> {
  return app.models.Category.findAll({
    where:
      scope.parentId === null
        ? {
            userId,
            parentId: null,
            kind: scope.kind,
            expenseGroup: scope.expenseGroup,
            isSystem: false,
          }
        : { userId, parentId: scope.parentId, isSystem: false },
    order: [
      ['sortOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
    transaction,
  })
}

export async function nextCategorySortOrder(
  app: AppDependencies,
  userId: string,
  scope: CategorySiblingScope,
  transaction?: Transaction,
): Promise<number> {
  const siblings = await findSiblings(app, userId, scope, transaction)
  return siblings.reduce(
    (next, sibling) => Math.max(next, sibling.sortOrder + 1),
    0,
  )
}

export async function withUniqueName<Result>(
  operation: () => Promise<Result>,
): Promise<Result> {
  try {
    return await operation()
  } catch (error) {
    if (error instanceof UniqueConstraintError) {
      throw conflict('category_name_taken')
    }
    throw error
  }
}

export async function subtreeIds(
  app: AppDependencies,
  category: CategoryModel,
  transaction?: Transaction,
): Promise<string[]> {
  const children = await app.models.Category.findAll({
    attributes: ['id'],
    where: { userId: category.userId, parentId: category.id },
    order: [
      ['sortOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
    transaction,
  })
  return [category.id, ...children.map((child) => child.id)]
}

export async function findReplacement(
  app: AppDependencies,
  category: CategoryModel,
  replacementId: string,
  removedIds: readonly string[],
  transaction?: Transaction,
): Promise<CategoryModel> {
  const replacement = await findUserCategory(
    app,
    category.userId,
    replacementId,
    transaction,
  )
  if (
    removedIds.includes(replacement.id) ||
    replacement.kind !== category.kind ||
    replacement.isSystem ||
    replacement.archivedAt !== null
  ) {
    throw conflict('invalid_replacement')
  }
  return replacement
}

export async function reassignCategories(
  app: AppDependencies,
  userId: string,
  removedIds: readonly string[],
  replacement: CategoryModel,
  transaction: Transaction,
): Promise<void> {
  const where = { userId, categoryId: { [Op.in]: [...removedIds] } }
  await app.models.Transaction.update(
    { categoryId: replacement.id },
    { where, transaction },
  )
  await app.models.Schedule.update(
    { categoryId: replacement.id },
    { where, transaction },
  )
  await app.models.CategorizationRule.update(
    { actionCategoryId: replacement.id },
    {
      where: { userId, actionCategoryId: { [Op.in]: [...removedIds] } },
      transaction,
    },
  )
  const memberships = await app.models.EnvelopeCategory.findAll({
    where,
    transaction,
  })
  const inherited = removedIds
    .map((id) => memberships.find((membership) => membership.categoryId === id))
    .find((membership) => membership !== undefined)
  const replacementMembership = await app.models.EnvelopeCategory.findOne({
    where: { userId, categoryId: replacement.id },
    transaction,
  })
  await app.models.EnvelopeCategory.destroy({ where, transaction })
  if (inherited !== undefined && replacementMembership === null) {
    await app.models.EnvelopeCategory.create(
      {
        userId,
        envelopeId: inherited.envelopeId,
        categoryId: replacement.id,
      },
      { transaction },
    )
  }
}
