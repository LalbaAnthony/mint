import { resourceIdParamsSchema } from '@mint/shared/schemas/admin'
import {
  categoryListResponseSchema,
  categorySchema,
  createCategoryRequestSchema,
  reorderCategoriesRequestSchema,
  updateCategoryRequestSchema,
} from '@mint/shared/schemas/categories'
import {
  ensureEditable,
  findAvailableParent,
  findParentOf,
  findSiblings,
  findUserCategory,
  nextCategorySortOrder,
  siblingScope,
  toCategory,
  withUniqueName,
} from '../categories/categories.js'
import { conflict, validationFailed } from '../http/http-error.js'
import { ensureSameMembers } from '../http/ordering.js'
import { defineUserRoute } from '../http/route.js'
import { errorResponse, noBody, noParams } from '../schemas/http.js'
import type { CategoryAttributes } from '../types/models.js'

const tag = 'categories'

const accessErrors = { 401: errorResponse('No valid session') }

const resourceErrors = {
  ...accessErrors,
  404: errorResponse('Unknown category'),
}

export const listCategoriesRoute = defineUserRoute({
  method: 'get',
  path: '/categories',
  summary:
    'List every category, archived and system ones included, with the inherited group of subcategories',
  tag,
  body: noBody,
  params: noParams,
  responses: {
    200: { description: 'Categories', schema: categoryListResponseSchema },
    ...accessErrors,
  },
  handle: async ({ app, user }) => {
    const categories = await app.models.Category.findAll({
      where: { userId: user.id },
      order: [
        ['sortOrder', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    })
    const byId = new Map(categories.map((category) => [category.id, category]))
    return {
      status: 200,
      body: categories.map((category) =>
        toCategory(
          category,
          category.parentId === null
            ? null
            : (byId.get(category.parentId) ?? null),
        ),
      ),
    }
  },
})

export const createCategoryRoute = defineUserRoute({
  method: 'post',
  path: '/categories',
  summary:
    'Create a first-level category or a subcategory of an active first-level category of the same kind (CAT-02, CAT-04)',
  tag,
  body: createCategoryRequestSchema,
  params: noParams,
  responses: {
    201: { description: 'Category created', schema: categorySchema },
    400: errorResponse('Invalid request body'),
    ...resourceErrors,
    409: errorResponse(
      'Name already used at this level, invalid or archived parent',
    ),
  },
  handle: async ({ app, user, body }) => {
    const parent =
      body.parentId === null
        ? null
        : await findAvailableParent(app, user.id, body.parentId, body.kind)
    const scope = {
      parentId: parent?.id ?? null,
      kind: body.kind,
      expenseGroup: body.expenseGroup,
    }
    const category = await withUniqueName(async () =>
      app.models.Category.create({
        userId: user.id,
        parentId: scope.parentId,
        kind: body.kind,
        expenseGroup: body.expenseGroup,
        name: body.name,
        sortOrder: await nextCategorySortOrder(app, user.id, scope),
      }),
    )
    return { status: 201, body: toCategory(category, parent) }
  },
})

export const updateCategoryRoute = defineUserRoute({
  method: 'patch',
  path: '/categories/:id',
  summary:
    'Rename a category, change the group of a first-level expense category or move a subcategory to another parent',
  tag,
  body: updateCategoryRequestSchema,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Category modified', schema: categorySchema },
    400: errorResponse('Invalid body or change not allowed at this level'),
    ...resourceErrors,
    409: errorResponse(
      'System or archived category, name already used, invalid or archived parent',
    ),
  },
  handle: async ({ app, user, params, body }) => {
    const category = await findUserCategory(app, user.id, params.id)
    ensureEditable(category)
    const isFirstLevel = category.parentId === null
    if (
      body.expenseGroup !== undefined &&
      !(isFirstLevel && category.kind === 'expense')
    ) {
      throw validationFailed([
        { path: ['expenseGroup'], message: 'group_not_allowed' },
      ])
    }
    if (body.parentId !== undefined && isFirstLevel) {
      throw validationFailed([
        { path: ['parentId'], message: 'parent_not_allowed' },
      ])
    }
    const changes: Partial<CategoryAttributes> = {}
    if (body.name !== undefined) {
      changes.name = body.name
    }
    if (
      body.expenseGroup !== undefined &&
      body.expenseGroup !== category.expenseGroup
    ) {
      changes.expenseGroup = body.expenseGroup
      changes.sortOrder = await nextCategorySortOrder(app, user.id, {
        parentId: null,
        kind: category.kind,
        expenseGroup: body.expenseGroup,
      })
    }
    if (body.parentId !== undefined && body.parentId !== category.parentId) {
      if (category.kind === 'adjustment') {
        throw conflict('invalid_parent')
      }
      const parent = await findAvailableParent(
        app,
        user.id,
        body.parentId,
        category.kind,
      )
      changes.parentId = parent.id
      changes.sortOrder = await nextCategorySortOrder(app, user.id, {
        parentId: parent.id,
        kind: category.kind,
        expenseGroup: null,
      })
    }
    await withUniqueName(() => category.update(changes))
    return {
      status: 200,
      body: toCategory(category, await findParentOf(app, category)),
    }
  },
})

export const archiveCategoryRoute = defineUserRoute({
  method: 'post',
  path: '/categories/:id/archive',
  summary:
    'Archive a category and its active subcategories; it is no longer offered for input',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Category archived', schema: categorySchema },
    ...resourceErrors,
    409: errorResponse('System or already archived category'),
  },
  handle: async ({ app, user, params }) => {
    const now = app.clock.now()
    const category = await app.sequelize.transaction(async (transaction) => {
      const found = await findUserCategory(app, user.id, params.id, transaction)
      ensureEditable(found)
      await found.update({ archivedAt: now }, { transaction })
      await app.models.Category.update(
        { archivedAt: now },
        {
          where: { userId: user.id, parentId: found.id, archivedAt: null },
          transaction,
        },
      )
      return found
    })
    return {
      status: 200,
      body: toCategory(category, await findParentOf(app, category)),
    }
  },
})

export const restoreCategoryRoute = defineUserRoute({
  method: 'post',
  path: '/categories/:id/restore',
  summary:
    'Restore an archived category alone; a subcategory needs an active parent',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    200: { description: 'Category restored', schema: categorySchema },
    ...resourceErrors,
    409: errorResponse('System or active category, or archived parent'),
  },
  handle: async ({ app, user, params }) => {
    const category = await findUserCategory(app, user.id, params.id)
    if (category.isSystem) {
      throw conflict('system_category')
    }
    if (category.archivedAt === null) {
      throw conflict('not_archived')
    }
    const parent = await findParentOf(app, category)
    if (parent !== null && parent.archivedAt !== null) {
      throw conflict('parent_archived')
    }
    await category.update({ archivedAt: null })
    return { status: 200, body: toCategory(category, parent) }
  },
})

export const deleteCategoryRoute = defineUserRoute({
  method: 'delete',
  path: '/categories/:id',
  summary: 'Delete a category and its subcategories, system ones excepted',
  tag,
  body: noBody,
  params: resourceIdParamsSchema,
  responses: {
    204: { description: 'Category and its subcategories deleted' },
    ...resourceErrors,
    409: errorResponse('System category (CAT-08)'),
  },
  handle: async ({ app, user, params }) => {
    await app.sequelize.transaction(async (transaction) => {
      const category = await findUserCategory(
        app,
        user.id,
        params.id,
        transaction,
      )
      if (category.isSystem) {
        throw conflict('system_category')
      }
      await app.models.Category.destroy({
        where: { userId: user.id, parentId: category.id },
        transaction,
      })
      await category.destroy({ transaction })
    })
    return { status: 204 }
  },
})

export const reorderCategoriesRoute = defineUserRoute({
  method: 'post',
  path: '/categories/reorder',
  summary:
    'Set the display order of sibling categories: one group or kind at the first level, one parent below',
  tag,
  body: reorderCategoriesRequestSchema,
  params: noParams,
  responses: {
    204: { description: 'Order saved' },
    400: errorResponse('Invalid request body'),
    ...accessErrors,
    409: errorResponse('The list is not exactly a set of sibling categories'),
  },
  handle: async ({ app, user, body }) => {
    await app.sequelize.transaction(async (transaction) => {
      const [firstId] = body.categoryIds
      const first =
        firstId === undefined
          ? null
          : await app.models.Category.findOne({
              where: { id: firstId, userId: user.id, isSystem: false },
              transaction,
            })
      if (first === null) {
        throw conflict('order_mismatch')
      }
      const siblings = await findSiblings(
        app,
        user.id,
        siblingScope(first),
        transaction,
      )
      ensureSameMembers(
        siblings.map((sibling) => sibling.id),
        body.categoryIds,
      )
      for (const [index, id] of body.categoryIds.entries()) {
        await app.models.Category.update(
          { sortOrder: index },
          { where: { id, userId: user.id }, transaction },
        )
      }
    })
    return { status: 204 }
  },
})
