import type { Account } from '@mint/shared/types/accounts'

export type StatementFormState = {
  date: string
  balance: string
}

export interface StatementsModalProps {
  account: Account | null
}

export type StatementsModalEmits = {
  changed: []
}
