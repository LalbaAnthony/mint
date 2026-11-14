import type {
  PlannedMovement,
  ScheduleInput,
  SchedulePosting,
} from '../types/schedules.js'

export function postingAccountIds(posting: SchedulePosting): string[] {
  return posting.kind === 'transfer'
    ? [posting.sourceAccountId, posting.targetAccountId]
    : [posting.accountId]
}

export function isPostable(
  schedule: ScheduleInput,
  activeAccountIds: ReadonlySet<string>,
): boolean {
  return (
    schedule.active &&
    postingAccountIds(schedule.posting).every((accountId) =>
      activeAccountIds.has(accountId),
    )
  )
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
