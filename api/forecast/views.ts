import { Op } from 'sequelize'
import {
  aggregateEndOfDayBalances,
  endOfDayBalances,
} from '@mint/shared/engines/balances'
import {
  addDays,
  enumerateDays,
  earlierDate,
  monthEnd,
  monthStart,
} from '@mint/shared/engines/dates'
import { computeForecast, forecastEndDate } from '@mint/shared/engines/forecast'
import type { AccountInput } from '@mint/shared/types/accounts'
import type {
  BalanceCurvePoint,
  BalanceCurveResponse,
  CalendarDay,
  CalendarDayPeriod,
  CalendarMonthResponse,
  DailyBalance,
  Forecast,
  ForecastFlow,
  ForecastScopeQuery,
} from '@mint/shared/types/forecast'
import type { Operation } from '@mint/shared/types/operations'
import { conflict, notFound, validationFailed } from '../http/http-error.js'
import { toOperations } from '../operations/operations.js'
import {
  loadAccountInputs,
  loadCategoryInputs,
  loadEnvelopeCategoryIds,
  loadPaymentMethodsById,
  loadScheduleInputs,
  toEnvelopeInput,
  toOperationInput,
} from '../planning/inputs.js'
import type { ForecastData, ForecastScope } from '../types/forecast.js'
import type { UserModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'

export const realCurveDays = 30

export async function loadForecastData(
  data: DataAccess,
  userId: string,
): Promise<ForecastData> {
  const envelopes = await data.models.Envelope.findAll({
    where: { userId },
    order: [
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
  })
  const categoryIds = await loadEnvelopeCategoryIds(
    data,
    envelopes.map((envelope) => envelope.id),
  )
  const paymentMethods = await loadPaymentMethodsById(data, userId)
  const transactions = await data.models.Transaction.findAll({
    where: { userId },
  })
  return {
    accounts: await loadAccountInputs(data, userId),
    operations: transactions.map(toOperationInput),
    schedules: await loadScheduleInputs(data, userId),
    envelopes: envelopes.map((envelope) =>
      toEnvelopeInput(
        envelope,
        categoryIds.get(envelope.id) ?? [],
        paymentMethods,
      ),
    ),
    categories: await loadCategoryInputs(data, userId),
  }
}

function resolveScope(
  user: UserModel,
  forecastData: ForecastData,
  query: ForecastScopeQuery,
  today: string,
): ForecastScope {
  const activeAccounts = forecastData.accounts.filter(
    (account) => !account.archived,
  )
  const horizonMonths = query.horizonMonths ?? user.forecastHorizonMonths
  let selected: AccountInput | null = null
  if (query.accountId !== undefined) {
    const found = forecastData.accounts.find(
      (account) => account.id === query.accountId,
    )
    if (found === undefined) {
      throw notFound()
    }
    if (found.archived) {
      throw conflict('account_archived')
    }
    selected = found
  }
  return {
    today,
    horizonMonths,
    endDate: forecastEndDate(today, horizonMonths),
    account: selected,
    scopeAccounts: selected === null ? activeAccounts : [selected],
    activeAccountIds: new Set(activeAccounts.map((account) => account.id)),
  }
}

function realBalances(
  scope: ForecastScope,
  forecastData: ForecastData,
  from: string,
  to: string,
): DailyBalance[] {
  if (to < from) {
    return []
  }
  return scope.account === null
    ? aggregateEndOfDayBalances(
        scope.scopeAccounts,
        forecastData.operations,
        from,
        to,
      )
    : endOfDayBalances(scope.account, forecastData.operations, from, to)
}

function forecastBalances(
  scope: ForecastScope,
  forecast: Forecast,
): Map<string, number | null> {
  if (scope.account === null) {
    const hasAccounts = scope.scopeAccounts.length > 0
    return new Map(
      forecast.aggregate.days.map((day) => [
        day.date,
        hasAccounts ? day.totalCents : null,
      ]),
    )
  }
  const accountId = scope.account.id
  const account = forecast.accounts.find(
    (candidate) => candidate.accountId === accountId,
  )
  return new Map(
    (account?.days ?? []).map((day) => [day.date, day.balanceCents]),
  )
}

function scopeIndicators(scope: ForecastScope, forecast: Forecast) {
  if (scope.account === null) {
    return scope.scopeAccounts.length === 0
      ? null
      : forecast.aggregate.indicators
  }
  const accountId = scope.account.id
  return (
    forecast.accounts.find((account) => account.accountId === accountId)
      ?.indicators ?? null
  )
}

function runForecast(
  scope: ForecastScope,
  forecastData: ForecastData,
): Forecast {
  return computeForecast({
    today: scope.today,
    horizonMonths: scope.horizonMonths,
    ...forecastData,
  })
}

export async function balanceCurve(
  data: DataAccess,
  user: UserModel,
  query: ForecastScopeQuery,
  today: string,
): Promise<BalanceCurveResponse> {
  const forecastData = await loadForecastData(data, user.id)
  const scope = resolveScope(user, forecastData, query, today)
  const forecast = runForecast(scope, forecastData)
  const projected = forecastBalances(scope, forecast)
  const past: BalanceCurvePoint[] = realBalances(
    scope,
    forecastData,
    addDays(today, -realCurveDays),
    addDays(today, -1),
  ).map((day) => ({ ...day, forecast: false }))
  const future: BalanceCurvePoint[] = enumerateDays(today, scope.endDate).map(
    (date) => ({
      date,
      balanceCents: projected.get(date) ?? null,
      forecast: true,
    }),
  )
  return {
    today,
    accountId: scope.account?.id ?? null,
    thresholdCents: scope.account?.lowBalanceThresholdCents ?? null,
    horizonMonths: scope.horizonMonths,
    endDate: scope.endDate,
    points: [...past, ...future],
    indicators: scopeIndicators(scope, forecast),
  }
}

function firstHistoryMonth(scope: ForecastScope): string {
  return monthStart(
    scope.scopeAccounts.reduce(
      (earliest, account) => earlierDate(earliest, account.initialBalanceDate),
      scope.today,
    ),
  )
}

function periodOf(date: string, scope: ForecastScope): CalendarDayPeriod {
  if (date < scope.today) {
    return 'past'
  }
  if (date === scope.today) {
    return 'today'
  }
  return date <= scope.endDate ? 'future' : 'beyond'
}

function inScope(scope: ForecastScope, accountId: string): boolean {
  return scope.account === null
    ? scope.activeAccountIds.has(accountId)
    : scope.account.id === accountId
}

function isNeutralInScope(scope: ForecastScope, operation: Operation): boolean {
  return (
    scope.account === null &&
    operation.counterpartAccountId !== null &&
    scope.activeAccountIds.has(operation.counterpartAccountId)
  )
}

function flowsOfDay(
  scope: ForecastScope,
  forecast: Forecast,
  date: string,
): { accountId: string; flow: ForecastFlow }[] {
  return forecast.accounts.flatMap((account) => {
    if (!inScope(scope, account.accountId)) {
      return []
    }
    const day = account.days.find((candidate) => candidate.date === date)
    return (day?.flows ?? []).map((flow) => ({
      accountId: account.accountId,
      flow,
    }))
  })
}

function plannedContent(
  scope: ForecastScope,
  forecast: Forecast,
  date: string,
): Pick<CalendarDay, 'occurrences' | 'envelopeShares'> {
  const content: Pick<CalendarDay, 'occurrences' | 'envelopeShares'> = {
    occurrences: [],
    envelopeShares: [],
  }
  for (const { accountId, flow } of flowsOfDay(scope, forecast, date)) {
    if (flow.source === 'occurrence') {
      if (scope.account === null && flow.kind === 'transfer') {
        continue
      }
      content.occurrences.push({
        scheduleId: flow.scheduleId,
        kind: flow.kind,
        label: flow.label,
        accountId,
        amountCents: flow.amountCents,
        triggerMode: flow.triggerMode,
        isSubscription: flow.isSubscription,
        occurrence: {
          originalDate: flow.originalDate,
          effectiveDate: flow.effectiveDate,
          amountCents: flow.occurrenceAmountCents,
          status: 'pending',
          overridden: flow.overridden,
          editable: flow.effectiveDate > scope.today,
        },
      })
    } else if (flow.source === 'envelope') {
      content.envelopeShares.push({
        envelopeId: flow.envelopeId,
        label: flow.label,
        accountId,
        amountCents: flow.amountCents,
      })
    }
  }
  return content
}

async function monthOperations(
  data: DataAccess,
  userId: string,
  scope: ForecastScope,
  from: string,
  to: string,
): Promise<Map<string, Operation[]>> {
  const grouped = new Map<string, Operation[]>()
  if (to < from || scope.scopeAccounts.length === 0) {
    return grouped
  }
  const rows = await data.models.Transaction.findAll({
    where: {
      userId,
      accountId: {
        [Op.in]: scope.scopeAccounts.map((account) => account.id),
      },
      date: { [Op.between]: [from, to] },
    },
    order: [
      ['date', 'ASC'],
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ],
  })
  for (const operation of await toOperations(data, rows)) {
    if (isNeutralInScope(scope, operation)) {
      continue
    }
    grouped.set(operation.date, [
      ...(grouped.get(operation.date) ?? []),
      operation,
    ])
  }
  return grouped
}

export async function calendarMonth(
  data: DataAccess,
  user: UserModel,
  month: string,
  query: ForecastScopeQuery,
  today: string,
): Promise<CalendarMonthResponse> {
  const forecastData = await loadForecastData(data, user.id)
  const scope = resolveScope(user, forecastData, query, today)
  const firstMonth = firstHistoryMonth(scope)
  const lastMonth = monthStart(scope.endDate)
  if (month < firstMonth || month > lastMonth) {
    throw validationFailed([{ path: ['month'], message: 'month_out_of_range' }])
  }
  const lastDay = monthEnd(month)
  const forecast = runForecast(scope, forecastData)
  const projected = forecastBalances(scope, forecast)
  const real = new Map(
    realBalances(
      scope,
      forecastData,
      month,
      earlierDate(lastDay, addDays(today, -1)),
    ).map((day) => [day.date, day.balanceCents]),
  )
  const operations = await monthOperations(
    data,
    user.id,
    scope,
    month,
    earlierDate(lastDay, scope.endDate),
  )
  const days = enumerateDays(month, lastDay).map((date): CalendarDay => {
    const period = periodOf(date, scope)
    const planned =
      period === 'today' || period === 'future'
        ? plannedContent(scope, forecast, date)
        : { occurrences: [], envelopeShares: [] }
    return {
      date,
      period,
      balanceCents:
        period === 'past'
          ? (real.get(date) ?? null)
          : (projected.get(date) ?? null),
      operations: period === 'beyond' ? [] : (operations.get(date) ?? []),
      ...planned,
    }
  })
  return {
    today,
    accountId: scope.account?.id ?? null,
    thresholdCents: scope.account?.lowBalanceThresholdCents ?? null,
    horizonMonths: scope.horizonMonths,
    endDate: scope.endDate,
    month,
    firstMonth,
    lastMonth,
    days,
  }
}
