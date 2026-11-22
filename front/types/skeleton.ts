import type { AsyncComponentLoader, Component } from 'vue'

export type SkeletonShape = 'text' | 'control' | 'round'

export interface SkeletonBlockProps {
  shape?: SkeletonShape
}

export type SkeletonWidth = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'full'

export type SkeletonTextAlign = 'start' | 'center' | 'end'

export interface SkeletonTextProps {
  width?: SkeletonWidth
  lines?: number
  align?: SkeletonTextAlign
}

export interface SkeletonAmountProps {
  concealable?: boolean
}

export type SkeletonCircleSize = 10 | 16 | 20 | 40 | 64

export interface SkeletonCircleProps {
  size: SkeletonCircleSize
}

export type SkeletonControlKind =
  | 'field'
  | 'button'
  | 'icon-button'
  | 'touch-icon-button'
  | 'checkbox'
  | 'badge'

export type SkeletonControlSize = 'sm' | 'md'

export interface SkeletonControlProps {
  kind: SkeletonControlKind
  size?: SkeletonControlSize
}

export interface ChartHeight {
  mobile: number
  desktop: number
}

export interface SkeletonChartProps {
  height: ChartHeight
}

export type ListRowElement = 'li' | 'div' | 'button'

export type ListRowGap = 1 | 2 | 3

export type ListRowPadding = 0 | 1 | 1.5 | 2 | 3

export type ListRowAlign = 'center' | 'start' | 'end' | 'stretch'

export type ListRowDirection = 'row' | 'column' | 'responsive'

export interface ListRowLayout {
  gap?: ListRowGap
  padding?: ListRowPadding
  flush?: boolean
  inset?: boolean
  align?: ListRowAlign
  direction?: ListRowDirection
  wrap?: boolean
  spread?: boolean
}

export interface ListRowProps extends ListRowLayout {
  as?: ListRowElement
}

export interface SkeletonListProps {
  count?: number
  row?: ListRowLayout
  ordered?: boolean
}

export type StatGridColumns = 2 | 3 | 4

export interface StatGridProps {
  columns: StatGridColumns
}

export type StatTileEmphasis = 'primary' | 'secondary'

export interface StatTileProps {
  label: string
  emphasis?: StatTileEmphasis
  icon?: string
}

export type LoadPhase = 'pending' | 'skeleton' | 'ready' | 'error'

export type LoadMode = 'context' | 'background'

export type Loader = () => Promise<void>

export interface LoadStateOptions {
  onError?: (error: unknown) => void
  delayMs?: number
  minimumMs?: number
}

export interface LoadState {
  readonly phase: LoadPhase
  readonly loading: boolean
  readonly settled: boolean
  run: (loader: Loader, mode?: LoadMode) => Promise<void>
  retry: () => Promise<void>
}

export interface LoadZoneProps {
  state: LoadState
  errorState?: boolean
}

export type LoadErrorEmits = {
  retry: []
}

export interface LazyComponent<T extends Component = Component> {
  component: T
  load: AsyncComponentLoader<T>
}

export type SkeletonTableCell =
  | 'text'
  | 'text-detail'
  | 'date'
  | 'amount'
  | 'checkbox'
  | 'actions'
  | 'progress'
  | 'empty'

export interface SkeletonTableColumn {
  id: string
  header: string
  cell: SkeletonTableCell
  concealable?: boolean
}

export interface SkeletonTableRow {
  index: number
}

export interface EnvelopeRowSkeletonProps {
  index: number
}

export interface SkeletonTableProps {
  columns: SkeletonTableColumn[]
  count?: number
}

export interface CalendarGridSkeletonProps {
  month: string
  compact: boolean
}
