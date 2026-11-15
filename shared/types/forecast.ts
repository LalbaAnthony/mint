import type { z } from 'zod'
import type {
  balanceCurvePointSchema,
  balanceCurveResponseSchema,
  calendarDayPeriodSchema,
  calendarDaySchema,
  calendarEnvelopeShareSchema,
  calendarMonthResponseSchema,
  calendarOccurrenceSchema,
  forecastScopeQuerySchema,
} from '../schemas/forecast.js'
import type { AccountInput, AccountUsage } from './accounts.js'
import type { CategoryInput } from './categories.js'
import type { EnvelopeInput } from './envelopes.js'
import type { ScheduleInput, ScheduleKind, TriggerMode } from './schedules.js'
import type { OperationInput } from './transactions.js'

export type ForecastInput = {
  today: string
  horizonMonths: number
  accounts: AccountInput[]
  operations: OperationInput[]
  schedules: ScheduleInput[]
  envelopes: EnvelopeInput[]
  categories: CategoryInput[]
}

export type OccurrenceFlow = {
  source: 'occurrence'
  scheduleId: string
  kind: ScheduleKind
  label: string
  originalDate: string
  effectiveDate: string
  amountCents: number
  occurrenceAmountCents: number
  overridden: boolean
  triggerMode: TriggerMode
  isSubscription: boolean
}

export type OperationFlow = {
  source: 'operation'
  operationId: string
  amountCents: number
}

export type EnvelopeFlow = {
  source: 'envelope'
  envelopeId: string
  label: string
  amountCents: number
}

export type ForecastFlow = OccurrenceFlow | OperationFlow | EnvelopeFlow

export type BalancePoint = {
  date: string
  balanceCents: number
}

export type ForecastDay = BalancePoint & {
  flows: ForecastFlow[]
}

export type ForecastIndicators = {
  minBalanceCents: number
  minBalanceDate: string
  firstBelowThresholdDate: string | null
  firstNegativeDate: string | null
}

export type AccountForecast = {
  accountId: string
  usage: AccountUsage
  days: ForecastDay[]
  indicators: ForecastIndicators
}

export type UsageSubtotals = Record<AccountUsage, number>

export type AggregateForecastDay = {
  date: string
  totalCents: number
  usageSubtotals: UsageSubtotals
}

export type AggregateForecast = {
  days: AggregateForecastDay[]
  indicators: ForecastIndicators
}

export type Forecast = {
  startDate: string
  endDate: string
  accounts: AccountForecast[]
  aggregate: AggregateForecast
}

export type DailyBalance = {
  date: string
  balanceCents: number | null
}

export type ForecastScopeQuery = z.infer<typeof forecastScopeQuerySchema>

export type BalanceCurvePoint = z.infer<typeof balanceCurvePointSchema>

export type BalanceCurveResponse = z.infer<typeof balanceCurveResponseSchema>

export type CalendarDayPeriod = z.infer<typeof calendarDayPeriodSchema>

export type CalendarOccurrence = z.infer<typeof calendarOccurrenceSchema>

export type CalendarEnvelopeShare = z.infer<typeof calendarEnvelopeShareSchema>

export type CalendarDay = z.infer<typeof calendarDaySchema>

export type CalendarMonthResponse = z.infer<typeof calendarMonthResponseSchema>
