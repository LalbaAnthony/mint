import { z } from 'zod'
import { monthSchema } from './envelopes.js'
import { operationSchema } from './operations.js'
import {
  scheduleKindSchema,
  scheduleOccurrenceSchema,
  triggerModeSchema,
} from './schedules.js'
import { forecastHorizonMaxMonths, forecastHorizonMinMonths } from './user.js'

export const calendarDayPeriods = ['past', 'today', 'future', 'beyond'] as const

export const forecastScopeQuerySchema = z
  .object({
    accountId: z.uuid({ error: 'invalid' }).optional(),
    horizonMonths: z.coerce
      .number({ error: 'invalid' })
      .int({ error: 'horizon_out_of_range' })
      .min(forecastHorizonMinMonths, { error: 'horizon_out_of_range' })
      .max(forecastHorizonMaxMonths, { error: 'horizon_out_of_range' })
      .optional(),
  })
  .meta({ id: 'ForecastScopeQuery' })

export const calendarMonthParamsSchema = z.object({ month: monthSchema })

export const forecastIndicatorsSchema = z
  .object({
    minBalanceCents: z.number().int(),
    minBalanceDate: z.iso.date(),
    firstBelowThresholdDate: z.iso.date().nullable(),
    firstNegativeDate: z.iso.date().nullable(),
  })
  .meta({ id: 'ForecastIndicators' })

export const forecastScopeSchema = z.object({
  today: z.iso.date(),
  accountId: z.uuid().nullable(),
  thresholdCents: z.number().int().nullable(),
  horizonMonths: z.number().int(),
  endDate: z.iso.date(),
})

export const balanceCurvePointSchema = z
  .object({
    date: z.iso.date(),
    balanceCents: z.number().int().nullable(),
    forecast: z.boolean(),
  })
  .meta({ id: 'BalanceCurvePoint' })

export const balanceCurveResponseSchema = forecastScopeSchema
  .extend({
    points: z.array(balanceCurvePointSchema),
    indicators: forecastIndicatorsSchema.nullable(),
  })
  .meta({ id: 'BalanceCurveResponse' })

export const calendarDayPeriodSchema = z
  .enum(calendarDayPeriods)
  .meta({ id: 'CalendarDayPeriod' })

export const calendarOccurrenceSchema = z
  .object({
    scheduleId: z.uuid(),
    kind: scheduleKindSchema,
    label: z.string(),
    accountId: z.uuid(),
    amountCents: z.number().int(),
    triggerMode: triggerModeSchema,
    isSubscription: z.boolean(),
    occurrence: scheduleOccurrenceSchema,
  })
  .meta({ id: 'CalendarOccurrence' })

export const calendarEnvelopeShareSchema = z
  .object({
    envelopeId: z.uuid(),
    label: z.string(),
    accountId: z.uuid(),
    amountCents: z.number().int(),
  })
  .meta({ id: 'CalendarEnvelopeShare' })

export const calendarDaySchema = z
  .object({
    date: z.iso.date(),
    period: calendarDayPeriodSchema,
    balanceCents: z.number().int().nullable(),
    operations: z.array(operationSchema),
    occurrences: z.array(calendarOccurrenceSchema),
    envelopeShares: z.array(calendarEnvelopeShareSchema),
  })
  .meta({ id: 'CalendarDay' })

export const calendarMonthResponseSchema = forecastScopeSchema
  .extend({
    month: z.iso.date(),
    firstMonth: z.iso.date(),
    lastMonth: z.iso.date(),
    days: z.array(calendarDaySchema),
  })
  .meta({ id: 'CalendarMonthResponse' })
