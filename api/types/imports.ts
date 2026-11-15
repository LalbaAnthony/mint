import type {
  ImportCandidate,
  InterpretedLine,
} from '@mint/shared/types/imports'

export type BankLine = {
  accountId: string
  date: string
  amountCents: number
  bankLabel: string
  dedupHash: string
}

export type ValidLine = Extract<InterpretedLine, { error: null }>

export type RowPlan = {
  line: ValidLine
  hash: string
  duplicate: boolean
  ruleId: string | null
  categoryId: string | null
  transferAccountId: string | null
  tagIds: string[]
  candidates: ImportCandidate[]
  proposed: ImportCandidate | null
}
