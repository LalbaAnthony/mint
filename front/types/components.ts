export interface ViewPanelProps {
  title: string
}

export interface AppBrandProps {
  variant: 'sidebar' | 'login'
  collapsed?: boolean
}

export interface AppFormFieldProps {
  label: string
  name: string
  hint?: string
}

export interface EmptyStateProps {
  icon: string
  title: string
  description: string
}

export interface ConfirmModalProps {
  title: string
  description: string
  confirmLabel: string
  pending?: boolean
}

export type ConfirmModalEmits = {
  confirm: []
}
