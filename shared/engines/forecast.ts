import type { AccountInput } from '../types/accounts.js'
import type {
  AccountForecast,
  AggregateForecast,
  AggregateForecastDay,
  BalancePoint,
  Forecast,
  ForecastDay,
  ForecastFlow,
  ForecastIndicators,
  ForecastInput,
  UsageSubtotals,
} from '../types/forecast.js'
import type { ProjectedOccurrence, ScheduleInput } from '../types/schedules.js'
import { calculatedBalanceCents } from './balances.js'
import {
  addMonthsClamped,
  enumerateDays,
  laterDate,
  monthEnd,
} from './dates.js'
import { envelopeCategoryIndex, envelopeDailyShares } from './envelopes.js'
import {
  activeAccountsById,
  postingMovements,
  postingStartDate,
} from './postings.js'
import { occurrencesBetween } from './recurrence.js'

export function forecastEndDate(today: string, horizonMonths: number): string {
  if (!Number.isInteger(horizonMonths) || horizonMonths < 1) {
    throw new RangeError('horizonMonths must be an integer >= 1')
  }
  return addMonthsClamped(today, horizonMonths)
}

export function projectOccurrences(
  schedules: readonly ScheduleInput[],
  activeAccounts: ReadonlyMap<string, AccountInput>,
  today: string,
  until: string,
): ProjectedOccurrence[] {
  return schedules.flatMap((schedule) => {
    const start = postingStartDate(schedule, activeAccounts)
    if (start === null) {
      return []
    }
    return occurrencesBetween(schedule, start, until)
      .filter((occurrence) => occurrence.status === 'pending')
      .map((occurrence) => ({
        schedule,
        occurrence,
        projectedDate: laterDate(occurrence.effectiveDate, today),
        movements: postingMovements(schedule.posting, occurrence.amountCents),
      }))
  })
}

export function forecastIndicators(
  days: readonly BalancePoint[],
  thresholdCents: number | null,
): ForecastIndicators {
  const [first] = days
  if (first === undefined) {
    throw new RangeError('A forecast has at least one day')
  }
  let minimum = first
  for (const day of days) {
    if (day.balanceCents < minimum.balanceCents) {
      minimum = day
    }
  }
  return {
    minBalanceCents: minimum.balanceCents,
    minBalanceDate: minimum.date,
    firstBelowThresholdDate:
      thresholdCents === null
        ? null
        : (days.find((day) => day.balanceCents < thresholdCents)?.date ?? null),
    firstNegativeDate: days.find((day) => day.balanceCents < 0)?.date ?? null,
  }
}

function flowKey(accountId: string, date: string): string {
  return `${accountId}|${date}`
}

function recordFlow(
  flows: Map<string, ForecastFlow[]>,
  accountId: string,
  date: string,
  flow: ForecastFlow,
): void {
  const key = flowKey(accountId, date)
  const existing = flows.get(key)
  if (existing === undefined) {
    flows.set(key, [flow])
  } else {
    existing.push(flow)
  }
}

function accountForecast(
  account: AccountInput,
  startingBalanceCents: number,
  days: readonly string[],
  flowsByAccountDate: ReadonlyMap<string, ForecastFlow[]>,
): AccountForecast {
  let balanceCents = startingBalanceCents
  const forecastDays: ForecastDay[] = days.map((date) => {
    const flows = flowsByAccountDate.get(flowKey(account.id, date)) ?? []
    balanceCents = flows.reduce(
      (balance, flow) => balance + flow.amountCents,
      balanceCents,
    )
    return { date, balanceCents, flows }
  })
  return {
    accountId: account.id,
    usage: account.usage,
    days: forecastDays,
    indicators: forecastIndicators(
      forecastDays,
      account.lowBalanceThresholdCents,
    ),
  }
}

function emptyUsageSubtotals(): UsageSubtotals {
  return { current: 0, emergency: 0, savings: 0, investment: 0 }
}

function aggregateForecast(
  accounts: readonly AccountForecast[],
  days: readonly string[],
): AggregateForecast {
  const aggregateDays: AggregateForecastDay[] = days.map((date, index) => {
    const usageSubtotals = emptyUsageSubtotals()
    let totalCents = 0
    for (const account of accounts) {
      const balanceCents = account.days[index]?.balanceCents ?? 0
      usageSubtotals[account.usage] += balanceCents
      totalCents += balanceCents
    }
    return { date, totalCents, usageSubtotals }
  })
  return {
    days: aggregateDays,
    indicators: forecastIndicators(
      aggregateDays.map((day) => ({
        date: day.date,
        balanceCents: day.totalCents,
      })),
      null,
    ),
  }
}

export function computeForecast(input: ForecastInput): Forecast {
  const startDate = input.today
  const endDate = forecastEndDate(startDate, input.horizonMonths)
  const activeAccounts = input.accounts.filter((account) => !account.archived)
  const activeAccountIds = new Set(activeAccounts.map((account) => account.id))
  const flows = new Map<string, ForecastFlow[]>()

  const projected = projectOccurrences(
    input.schedules,
    activeAccountsById(input.accounts),
    startDate,
    monthEnd(endDate),
  )
  for (const { schedule, occurrence, projectedDate, movements } of projected) {
    if (projectedDate > endDate) {
      continue
    }
    for (const movement of movements) {
      recordFlow(flows, movement.accountId, projectedDate, {
        source: 'occurrence',
        scheduleId: schedule.id,
        kind: schedule.posting.kind,
        label: schedule.label,
        originalDate: occurrence.originalDate,
        effectiveDate: occurrence.effectiveDate,
        amountCents: movement.amountCents,
        occurrenceAmountCents: occurrence.amountCents,
        overridden: occurrence.overridden,
        triggerMode: schedule.triggerMode,
        isSubscription: schedule.isSubscription,
      })
    }
  }

  for (const operation of input.operations) {
    if (
      activeAccountIds.has(operation.accountId) &&
      operation.date > startDate &&
      operation.date <= endDate
    ) {
      recordFlow(flows, operation.accountId, operation.date, {
        source: 'operation',
        operationId: operation.id,
        amountCents: operation.amountCents,
      })
    }
  }

  const shares = envelopeDailyShares({
    today: startDate,
    endDate,
    envelopes: input.envelopes.filter((envelope) =>
      activeAccountIds.has(envelope.accountId),
    ),
    categoryIndex: envelopeCategoryIndex(input.envelopes, input.categories),
    operations: input.operations,
    commitments: projected.flatMap(({ occurrence, movements }) =>
      movements.map((movement) => ({
        categoryId: movement.categoryId,
        date: occurrence.effectiveDate,
        amountCents: movement.amountCents,
      })),
    ),
  })
  for (const share of shares) {
    if (share.amountCents !== 0) {
      recordFlow(flows, share.accountId, share.date, {
        source: 'envelope',
        envelopeId: share.envelopeId,
        label: share.label,
        amountCents: -share.amountCents,
      })
    }
  }

  const days = enumerateDays(startDate, endDate)
  const accounts = activeAccounts.map((account) => {
    const startingBalanceCents = calculatedBalanceCents(
      account,
      input.operations,
      startDate,
    )
    if (startingBalanceCents === null) {
      throw new RangeError(
        `Account ${account.id} starts after the forecast start date`,
      )
    }
    return accountForecast(account, startingBalanceCents, days, flows)
  })

  return {
    startDate,
    endDate,
    accounts,
    aggregate: aggregateForecast(accounts, days),
  }
}
