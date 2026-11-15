import type { z } from 'zod'
import type {
  categoryKindSchema,
  categorySchema,
  createCategoryRequestSchema,
  deleteCategoryQuerySchema,
  editableCategoryKindSchema,
  expenseGroupSchema,
  reorderCategoriesRequestSchema,
  updateCategoryRequestSchema,
} from '../schemas/categories.js'

export type CategoryKind = z.infer<typeof categoryKindSchema>

export type EditableCategoryKind = z.infer<typeof editableCategoryKindSchema>

export type ExpenseGroup = z.infer<typeof expenseGroupSchema>

export type ExpenseGroupIssue = 'group_required' | 'group_not_allowed'

export type CreateCategoryRequest = z.infer<typeof createCategoryRequestSchema>

export type UpdateCategoryRequest = z.infer<typeof updateCategoryRequestSchema>

export type Category = z.infer<typeof categorySchema>

export type ReorderCategoriesRequest = z.infer<
  typeof reorderCategoriesRequestSchema
>

export type CategoryInput = {
  id: string
  parentId: string | null
  kind: CategoryKind
  expenseGroup: ExpenseGroup | null
}

export type DeleteCategoryQuery = z.infer<typeof deleteCategoryQuerySchema>
