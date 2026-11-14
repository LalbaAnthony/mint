import type { Category } from '@mint/shared/types/categories'
import type { CategoryNode, CategorySection } from '~~/types/referentials'

function bySortOrder(first: Category, second: Category): number {
  return first.sortOrder - second.sortOrder
}

export function buildCategorySections(
  categories: readonly Category[],
): CategorySection[] {
  const sorted = [...categories].sort(bySortOrder)
  const leaf = (category: Category): CategoryNode => ({
    category,
    children: [],
  })
  const roots = (matches: (category: Category) => boolean) =>
    sorted
      .filter(
        (category) =>
          category.parentId === null && !category.isSystem && matches(category),
      )
      .map((category) => ({
        category,
        children: sorted
          .filter((child) => child.parentId === category.id)
          .map(leaf),
      }))
  return [
    {
      id: 'needs',
      nodes: roots(
        (category) =>
          category.kind === 'expense' && category.expenseGroup === 'needs',
      ),
    },
    {
      id: 'wants',
      nodes: roots(
        (category) =>
          category.kind === 'expense' && category.expenseGroup === 'wants',
      ),
    },
    { id: 'income', nodes: roots((category) => category.kind === 'income') },
    {
      id: 'system',
      nodes: sorted.filter((category) => category.isSystem).map(leaf),
    },
  ]
}

export function applyCategoryOrder(
  categories: readonly Category[],
  orderedIds: readonly string[],
): Category[] {
  return categories.map((category) => {
    const position = orderedIds.indexOf(category.id)
    return position === -1 ? category : { ...category, sortOrder: position }
  })
}
