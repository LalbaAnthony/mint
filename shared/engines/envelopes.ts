import type { CategoryInput } from '../types/categories.js'
import type {
  EnvelopeInput,
  EnvelopeMonthOverride,
  EnvelopeMonthStatus,
  EnvelopeShare,
  EnvelopeSharesInput,
} from '../types/envelopes.js'
import type { CategorizedMovement } from '../types/transactions.js'
import { spreadEvenly } from './amounts.js'
import {
  enumerateDays,
  enumerateMonths,
  isWithin,
  monthEnd,
  monthStart,
} from './dates.js'

export function envelopeCategoryIndex(
  envelopes: readonly EnvelopeInput[],
  categories: readonly CategoryInput[],
): Map<string, string> {
  const index = new Map<string, string>()
  for (const envelope of envelopes) {
    if (!envelope.active) {
      continue
    }
    for (const categoryId of envelope.categoryIds) {
      index.set(categoryId, envelope.id)
    }
  }
  for (const category of categories) {
    if (category.parentId === null || index.has(category.id)) {
      continue
    }
    const parentEnvelopeId = index.get(category.parentId)
    if (parentEnvelopeId !== undefined) {
      index.set(category.id, parentEnvelopeId)
    }
  }
  return index
}

export function envelopeMonthOverride(
  envelope: EnvelopeInput,
  month: string,
): EnvelopeMonthOverride | null {
  return (
    envelope.monthOverrides.find((candidate) => candidate.month === month) ??
    null
  )
}

export function envelopeBudgetCents(
  envelope: EnvelopeInput,
  month: string,
): number {
  return (
    envelopeMonthOverride(envelope, month)?.amountCents ??
    envelope.monthlyAmountCents
  )
}

export function spentCents(
  envelopeId: string,
  from: string,
  to: string,
  movements: readonly CategorizedMovement[],
  categoryIndex: ReadonlyMap<string, string>,
): number {
  return movements.reduce((spent, movement) => {
    if (
      movement.categoryId === null ||
      categoryIndex.get(movement.categoryId) !== envelopeId ||
      !isWithin(movement.date, from, to)
    ) {
      return spent
    }
    return spent - movement.amountCents
  }, 0)
}

export function envelopeMonthStatus(
  envelope: EnvelopeInput,
  month: string,
  operations: readonly CategorizedMovement[],
  categoryIndex: ReadonlyMap<string, string>,
): EnvelopeMonthStatus {
  const firstMonth = monthStart(envelope.createdOn)
  const chain =
    envelope.carryOver && month > firstMonth
      ? enumerateMonths(firstMonth, month)
      : [month]
  let carriedOverCents = 0
  let status: EnvelopeMonthStatus | null = null
  for (const chainMonth of chain) {
    const budgetCents = envelopeBudgetCents(envelope, chainMonth)
    const consumedCents = spentCents(
      envelope.id,
      chainMonth,
      monthEnd(chainMonth),
      operations,
      categoryIndex,
    )
    status = {
      envelopeId: envelope.id,
      month: chainMonth,
      budgetCents,
      carriedOverCents,
      consumedCents,
      availableCents: budgetCents + carriedOverCents - consumedCents,
    }
    carriedOverCents = status.availableCents
  }
  if (status === null) {
    throw new RangeError(`No envelope status for ${month}`)
  }
  return status
}

function sharesOverDays(
  envelope: EnvelopeInput,
  remainingCents: number,
  firstDay: string,
  lastDay: string,
): EnvelopeShare[] {
  const days = enumerateDays(firstDay, lastDay)
  const amounts = spreadEvenly(Math.max(0, remainingCents), days.length)
  return days.map((date, index) => ({
    envelopeId: envelope.id,
    label: envelope.label,
    accountId: envelope.accountId,
    date,
    amountCents: amounts[index] ?? 0,
  }))
}

export function envelopeDailyShares(
  input: EnvelopeSharesInput,
): EnvelopeShare[] {
  const currentMonth = monthStart(input.today)
  const months = enumerateMonths(currentMonth, monthStart(input.endDate))
  return input.envelopes
    .filter((envelope) => envelope.active)
    .flatMap((envelope) =>
      months.flatMap((month) => {
        const lastDay = monthEnd(month)
        const committedCents = spentCents(
          envelope.id,
          month,
          lastDay,
          input.commitments,
          input.categoryIndex,
        )
        if (month === currentMonth) {
          const status = envelopeMonthStatus(
            envelope,
            month,
            input.operations,
            input.categoryIndex,
          )
          return sharesOverDays(
            envelope,
            status.availableCents - committedCents,
            input.today,
            lastDay,
          )
        }
        const consumedCents = spentCents(
          envelope.id,
          month,
          lastDay,
          input.operations,
          input.categoryIndex,
        )
        return sharesOverDays(
          envelope,
          envelopeBudgetCents(envelope, month) - consumedCents - committedCents,
          month,
          lastDay,
        )
      }),
    )
    .filter((share) => share.date <= input.endDate)
}
