import { z } from 'zod'
import type {
  EditableCategoryKind,
  ExpenseGroup,
  ExpenseGroupIssue,
} from '../types/categories.js'
import { labelSchema, orderedIdsSchema } from './common.js'

export const categoryKinds = ['expense', 'income', 'adjustment'] as const

export const editableCategoryKinds = ['expense', 'income'] as const

export const expenseGroups = ['needs', 'wants'] as const

export const categoryKindSchema = z
  .enum(categoryKinds)
  .meta({ id: 'CategoryKind' })

export const editableCategoryKindSchema = z
  .enum(editableCategoryKinds, { error: 'invalid' })
  .meta({ id: 'EditableCategoryKind' })

export const expenseGroupSchema = z
  .enum(expenseGroups, { error: 'invalid' })
  .meta({ id: 'ExpenseGroup' })

export function expenseGroupIssue(category: {
  kind: EditableCategoryKind
  parentId: string | null
  expenseGroup: ExpenseGroup | null
}): ExpenseGroupIssue | null {
  const needsGroup = category.kind === 'expense' && category.parentId === null
  if (needsGroup && category.expenseGroup === null) {
    return 'group_required'
  }
  if (!needsGroup && category.expenseGroup !== null) {
    return 'group_not_allowed'
  }
  return null
}

export const createCategoryRequestSchema = z
  .object({
    kind: editableCategoryKindSchema,
    name: labelSchema,
    parentId: z.uuid({ error: 'invalid' }).nullable(),
    expenseGroup: expenseGroupSchema.nullable(),
  })
  .superRefine((category, context) => {
    const issue = expenseGroupIssue(category)
    if (issue !== null) {
      context.addIssue({
        code: 'custom',
        message: issue,
        path: ['expenseGroup'],
      })
    }
  })
  .meta({ id: 'CreateCategoryRequest' })

export const updateCategoryRequestSchema = z
  .object({
    name: labelSchema.optional(),
    expenseGroup: expenseGroupSchema.optional(),
    parentId: z.uuid({ error: 'invalid' }).optional(),
  })
  .meta({ id: 'UpdateCategoryRequest' })

export const categorySchema = z
  .object({
    id: z.uuid(),
    parentId: z.uuid().nullable(),
    kind: categoryKindSchema,
    expenseGroup: expenseGroupSchema.nullable(),
    name: z.string(),
    isSystem: z.boolean(),
    sortOrder: z.number().int(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .meta({ id: 'Category' })

export const categoryListResponseSchema = z
  .array(categorySchema)
  .meta({ id: 'CategoryListResponse' })

export const reorderCategoriesRequestSchema = z
  .object({ categoryIds: orderedIdsSchema })
  .meta({ id: 'ReorderCategoriesRequest' })

export const deleteCategoryQuerySchema = z
  .object({ replacementId: z.uuid({ error: 'invalid' }).optional() })
  .meta({ id: 'DeleteCategoryQuery' })
