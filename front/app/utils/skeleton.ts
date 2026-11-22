import type { TableColumn } from '@nuxt/ui'
import type {
  ListRowAlign,
  ListRowDirection,
  ListRowGap,
  ListRowPadding,
  SkeletonCircleSize,
  SkeletonControlKind,
  SkeletonControlSize,
  SkeletonShape,
  SkeletonTableCell,
  SkeletonTableColumn,
  SkeletonTextAlign,
  SkeletonWidth,
  StatGridColumns,
  StatTileEmphasis,
} from '~~/types/skeleton'

export const skeletonDelayMs = 150

export const skeletonMinimumMs = 300

export const skeletonRowCount = 3

export const skeletonAccountGroupCount = 2

export const skeletonMaximumRowCount = 20

export function clampSkeletonRows(count: number): number {
  return Math.min(skeletonMaximumRowCount, Math.max(1, count))
}

export const skeletonShapeClasses = {
  text: 'rounded-sm',
  control: 'rounded-md',
  round: 'rounded-full',
} as const satisfies Record<SkeletonShape, string>

export const skeletonWidthClasses = {
  xs: 'w-12',
  sm: 'w-20',
  md: 'w-32',
  lg: 'w-48',
  xl: 'w-64',
  full: 'w-full',
} as const satisfies Record<SkeletonWidth, string>

export const skeletonTextAlignClasses = {
  start: '',
  center: 'justify-center',
  end: 'justify-end',
} as const satisfies Record<SkeletonTextAlign, string>

const rowWidths = ['lg', 'md', 'xl'] as const satisfies SkeletonWidth[]

export function skeletonRowWidth(index: number): SkeletonWidth {
  return rowWidths[index % rowWidths.length] ?? 'md'
}

export function skeletonIndexes(count: number = skeletonRowCount): number[] {
  return Array.from({ length: count }, (_, index) => index)
}

export const skeletonAmountWidthClasses = {
  shown: 'w-[8ch]',
  masked: 'w-[5ch]',
} as const

export const skeletonCircleClasses = {
  10: 'size-2.5',
  16: 'size-4',
  20: 'size-5',
  40: 'size-10',
  64: 'size-16',
} as const satisfies Record<SkeletonCircleSize, string>

export const skeletonControlClasses = {
  field: { sm: 'h-7', md: 'h-8' },
  button: { sm: 'h-7', md: 'h-8' },
  'icon-button': { sm: 'size-7', md: 'size-8' },
  'touch-icon-button': {
    sm: 'size-7 max-lg:size-11',
    md: 'size-8 max-lg:size-11',
  },
  checkbox: { sm: 'size-3.5', md: 'size-4' },
  badge: { sm: 'h-5', md: 'h-6' },
} as const satisfies Record<
  SkeletonControlKind,
  Record<SkeletonControlSize, string>
>

export const skeletonControlShapes = {
  field: 'control',
  button: 'control',
  'icon-button': 'control',
  'touch-icon-button': 'control',
  checkbox: 'text',
  badge: 'control',
} as const satisfies Record<SkeletonControlKind, SkeletonShape>

export const statGridColumnClasses = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-2 xl:grid-cols-4',
} as const satisfies Record<StatGridColumns, string>

export const statTileValueClasses = {
  primary: 'text-3xl font-bold',
  secondary: 'text-xl font-semibold',
} as const satisfies Record<StatTileEmphasis, string>

export const listRowGapClasses = {
  1: 'gap-1',
  2: 'gap-2',
  3: 'gap-3',
} as const satisfies Record<ListRowGap, string>

export const listRowPaddingClasses = {
  0: '',
  1: 'py-1',
  1.5: 'py-1.5',
  2: 'py-2',
  3: 'py-3',
} as const satisfies Record<ListRowPadding, string>

export const listRowAlignClasses = {
  center: 'items-center',
  start: 'items-start',
  end: 'items-end',
  stretch: '',
} as const satisfies Record<ListRowAlign, string>

export const listRowDirectionClasses = {
  row: '',
  column: 'flex-col',
  responsive: 'flex-col lg:flex-row lg:items-center',
} as const satisfies Record<ListRowDirection, string>

export function skeletonColumns<T>(
  columns: TableColumn<T>[],
  cells: Record<string, SkeletonTableCell>,
  concealable: readonly string[] = [],
): SkeletonTableColumn[] {
  return columns.map((column) => {
    const id =
      column.id ?? ('accessorKey' in column ? String(column.accessorKey) : '')
    return {
      id,
      header: typeof column.header === 'string' ? column.header : '',
      cell: cells[id] ?? 'text',
      concealable: concealable.includes(id),
    }
  })
}
