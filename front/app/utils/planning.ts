import type { Category, CategoryKind } from '@mint/shared/types/categories'
import type { Schedule } from '@mint/shared/types/schedules'
import type { CategoryOptionGroup, EnvelopeTone } from '~~/types/planning'

export function categoryOptionGroups(
  categories: readonly Category[],
  kinds: readonly CategoryKind[],
  kept: string | undefined,
  kindLabel: (kind: CategoryKind) => string,
): CategoryOptionGroup[] {
  const usable = (category: Category) =>
    (category.archivedAt === null || category.id === kept) &&
    category.kind !== 'adjustment'
  const ordered = [...categories].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  )
  return kinds.map((kind) => ({
    kind,
    label: kindLabel(kind),
    options: ordered
      .filter(
        (category) =>
          category.kind === kind &&
          category.parentId === null &&
          usable(category),
      )
      .flatMap((root) => [
        { label: root.name, value: root.id },
        ...ordered
          .filter((child) => child.parentId === root.id && usable(child))
          .map((child) => ({
            label: `${root.name} › ${child.name}`,
            value: child.id,
          })),
      ]),
  }))
}

export function envelopeTone(
  consumedCents: number,
  allowanceCents: number,
): EnvelopeTone {
  if (consumedCents * 5 <= allowanceCents * 4) {
    return 'primary'
  }
  return consumedCents <= allowanceCents ? 'warning' : 'error'
}

export function envelopeProgress(
  consumedCents: number,
  allowanceCents: number,
): number {
  if (allowanceCents <= 0) {
    return consumedCents > 0 ? 100 : 0
  }
  return Math.min(100, Math.max(0, (consumedCents / allowanceCents) * 100))
}

export function isFolded(schedule: Schedule): boolean {
  return !schedule.active || schedule.ended
}
