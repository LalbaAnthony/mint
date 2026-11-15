import type { AccountInput } from '../types/accounts.js'
import type {
  PlannedMovement,
  ScheduleInput,
  SchedulePosting,
} from '../types/schedules.js'
import { laterDate } from './dates.js'

export function postingAccountIds(posting: SchedulePosting): string[] {
  return posting.kind === 'transfer'
    ? [posting.sourceAccountId, posting.targetAccountId]
    : [posting.accountId]
}

export function activeAccountsById(
  accounts: readonly AccountInput[],
): Map<string, AccountInput> {
  return new Map(
    accounts
      .filter((account) => !account.archived)
      .map((account) => [account.id, account]),
  )
}

export function postingStartDate(
  schedule: ScheduleInput,
  activeAccounts: ReadonlyMap<string, AccountInput>,
): string | null {
  if (!schedule.active) {
    return null
  }
  let start = schedule.createdOn
  for (const accountId of postingAccountIds(schedule.posting)) {
    const account = activeAccounts.get(accountId)
    if (account === undefined) {
      return null
    }
    start = laterDate(start, account.initialBalanceDate)
  }
  return start
}

export function postingMovements(
  posting: SchedulePosting,
  amountCents: number,
): PlannedMovement[] {
  switch (posting.kind) {
    case 'expense':
      return [
        {
          accountId: posting.accountId,
          paymentMethodId: posting.paymentMethodId,
          categoryId: posting.categoryId,
          amountCents: -amountCents,
        },
      ]
    case 'income':
      return [
        {
          accountId: posting.accountId,
          paymentMethodId: posting.paymentMethodId,
          categoryId: posting.categoryId,
          amountCents,
        },
      ]
    case 'transfer':
      return [
        {
          accountId: posting.sourceAccountId,
          paymentMethodId: null,
          categoryId: null,
          amountCents: -amountCents,
        },
        {
          accountId: posting.targetAccountId,
          paymentMethodId: null,
          categoryId: null,
          amountCents,
        },
      ]
  }
}
