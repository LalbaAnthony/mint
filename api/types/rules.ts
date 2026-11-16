import type { Transaction } from 'sequelize'
import type { Operation } from '@mint/shared/types/operations'
import type {
  ReappliedClassification,
  ReapplySkipReason,
  RegexMatcher,
  RuleInput,
} from '@mint/shared/types/rules'
import type { AccountModel, CategoryModel, TransactionModel } from './models.js'
import type { DataAccess } from './planning.js'

export type ReapplyOutcome =
  | { kind: 'change'; after: ReappliedClassification }
  | { kind: 'skip'; reason: ReapplySkipReason }

export type ReapplyPlan = {
  operation: TransactionModel
  view: Operation
  outcome: ReapplyOutcome
}

export type ReapplyContext = {
  data: DataAccess
  userId: string
  rules: RuleInput[]
  matcher: RegexMatcher
  categories: ReadonlyMap<string, CategoryModel>
  accounts: ReadonlyMap<string, AccountModel>
  claimedCounterparts: Set<string>
  transaction: Transaction | undefined
}
