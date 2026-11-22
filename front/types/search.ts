import type { CommandPaletteGroup, CommandPaletteItem } from '@nuxt/ui'
import type { Account } from '@mint/shared/types/accounts'
import type { Operation } from '@mint/shared/types/operations'
import type { Schedule } from '@mint/shared/types/schedules'
import type { SearchEnvelope } from '@mint/shared/types/search'
import type { MoneyVariant } from './referentials'

export type SearchSection =
  'accounts' | 'operations' | 'schedules' | 'envelopes'

export type SearchTarget =
  | { kind: 'account'; account: Account }
  | { kind: 'operation'; operation: Operation }
  | { kind: 'schedule'; schedule: Schedule }
  | { kind: 'envelope'; envelope: SearchEnvelope }

export interface SearchPreviewItem extends CommandPaletteItem {
  amount?: SearchPreviewAmount
}

export type SearchPreviewGroup = CommandPaletteGroup<SearchPreviewItem>

export interface GlobalSearchOptions {
  operationsLimit: number
  initialText?: string
}

export interface SearchPreviewAmount {
  cents: number
  variant: MoneyVariant
  threshold: number | null
  concealable: boolean
}

export interface AppSearchTriggerProps {
  collapsed: boolean
}

export interface SearchAccountRowProps {
  account: Account
}

export interface SearchOperationRowProps {
  operation: Operation
}

export interface SearchScheduleRowProps {
  schedule: Schedule
}

export interface SearchEnvelopeRowProps {
  result: SearchEnvelope
}

export interface SearchSectionCardProps {
  section: SearchSection
  total: number
}
