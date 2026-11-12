export type NavigationEntryId =
  | 'home'
  | 'accounts'
  | 'calendar'
  | 'operations'
  | 'schedules'
  | 'subscriptions'
  | 'envelopes'
  | 'import'
  | 'rules'
  | 'profile'
  | 'administration'

export interface NavigationEntry {
  id: NavigationEntryId
  label: string
  icon: string
  to: string
}

export type QuickAddKind = 'expense' | 'income' | 'transfer'

export interface QuickAddEntry {
  kind: QuickAddKind
  label: string
  icon: string
  disabled: boolean
}
