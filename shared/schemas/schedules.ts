import { z } from 'zod'
import type { ScheduleFieldIssue, ScheduleFields } from '../types/schedules.js'
import { isoDateSchema, labelSchema } from './common.js'
import { noteSchema, positiveAmountCentsSchema } from './operations.js'
import { tagIdsSchema } from './tags.js'

export const scheduleKinds = ['expense', 'income', 'transfer'] as const

export const scheduleFrequencies = [
  'once',
  'weekly',
  'monthly',
  'yearly',
] as const

export const businessDayRules = ['exact', 'previous', 'next'] as const

export const triggerModes = ['auto', 'manual'] as const

export const occurrenceStates = ['overridden', 'skipped', 'executed'] as const

export const scheduleKindSchema = z
  .enum(scheduleKinds, { error: 'invalid' })
  .meta({ id: 'ScheduleKind' })

export const scheduleFrequencySchema = z
  .enum(scheduleFrequencies, { error: 'invalid' })
  .meta({ id: 'ScheduleFrequency' })

export const businessDayRuleSchema = z
  .enum(businessDayRules, { error: 'invalid' })
  .meta({ id: 'BusinessDayRule' })

export const triggerModeSchema = z
  .enum(triggerModes, { error: 'invalid' })
  .meta({ id: 'TriggerMode' })

export const occurrenceStateSchema = z
  .enum(occurrenceStates, { error: 'invalid' })
  .meta({ id: 'OccurrenceState' })

export const maxScheduleInterval = 99

export const maxScheduleOccurrences = 999

const optionalIdSchema = z.uuid({ error: 'invalid' }).nullable()

const recurrenceShape = {
  frequency: scheduleFrequencySchema,
  interval: z
    .number({ error: 'invalid' })
    .int({ error: 'invalid' })
    .min(1, { error: 'interval_out_of_range' })
    .max(maxScheduleInterval, { error: 'interval_out_of_range' }),
  startDate: isoDateSchema,
  anchorLastDay: z.boolean({ error: 'invalid' }),
  endDate: isoDateSchema.nullable(),
  maxOccurrences: z
    .number({ error: 'invalid' })
    .int({ error: 'invalid' })
    .min(1, { error: 'occurrences_out_of_range' })
    .max(maxScheduleOccurrences, { error: 'occurrences_out_of_range' })
    .nullable(),
  businessDayRule: businessDayRuleSchema,
}

export const maxBankLabelPatterns = 50

export const bankLabelPatternsSchema = z
  .array(
    z
      .string({ error: 'invalid' })
      .trim()
      .min(1, { error: 'required' })
      .max(200, { error: 'too_long' }),
    { error: 'invalid' },
  )
  .max(maxBankLabelPatterns, { error: 'too_long' })
  .transform((patterns) => [...new Set(patterns)])

export const amountToleranceSchema = z
  .number({ error: 'invalid' })
  .int({ error: 'invalid' })
  .min(0, { error: 'tolerance_out_of_range' })
  .max(100, { error: 'tolerance_out_of_range' })

export const defaultReminderDaysBefore = 2

export const maxReminderDaysBefore = 30

export const reminderDaysBeforeSchema = z
  .number({ error: 'invalid' })
  .int({ error: 'invalid' })
  .min(0, { error: 'reminder_out_of_range' })
  .max(maxReminderDaysBefore, { error: 'reminder_out_of_range' })

const commonShape = {
  label: labelSchema,
  amountCents: positiveAmountCentsSchema,
  triggerMode: triggerModeSchema,
  note: noteSchema,
  active: z.boolean({ error: 'invalid' }),
  amountTolerancePct: amountToleranceSchema.default(10),
  bankLabelPatterns: bankLabelPatternsSchema.default([]),
  tagIds: tagIdsSchema.default([]),
  reminderDaysBefore: reminderDaysBeforeSchema.default(
    defaultReminderDaysBefore,
  ),
  ...recurrenceShape,
}

const categorizedShape = {
  accountId: optionalIdSchema,
  paymentMethodId: optionalIdSchema,
  categoryId: z.uuid({ error: 'required' }),
}

const transferShape = {
  sourceAccountId: z.uuid({ error: 'required' }),
  targetAccountId: z.uuid({ error: 'required' }),
}

export const scheduleFieldsSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('expense'),
    ...commonShape,
    ...categorizedShape,
    isSubscription: z.boolean({ error: 'invalid' }),
  }),
  z.object({ kind: z.literal('income'), ...commonShape, ...categorizedShape }),
  z.object({ kind: z.literal('transfer'), ...commonShape, ...transferShape }),
])

export function scheduleFieldIssues(
  fields: ScheduleFields,
): ScheduleFieldIssue[] {
  const issues: ScheduleFieldIssue[] = []
  if (fields.endDate !== null && fields.maxOccurrences !== null) {
    issues.push({ path: ['maxOccurrences'], message: 'single_end' })
  }
  if (fields.endDate !== null && fields.endDate < fields.startDate) {
    issues.push({ path: ['endDate'], message: 'end_before_start' })
  }
  if (
    fields.anchorLastDay &&
    fields.frequency !== 'monthly' &&
    fields.frequency !== 'yearly'
  ) {
    issues.push({ path: ['anchorLastDay'], message: 'last_day_not_allowed' })
  }
  if (fields.frequency === 'once') {
    if (fields.interval !== 1) {
      issues.push({ path: ['interval'], message: 'interval_not_allowed' })
    }
    if (fields.endDate !== null || fields.maxOccurrences !== null) {
      issues.push({ path: ['endDate'], message: 'end_not_allowed' })
    }
  }
  if (fields.kind === 'transfer') {
    if (fields.sourceAccountId === fields.targetAccountId) {
      issues.push({ path: ['targetAccountId'], message: 'same_account' })
    }
  } else if (
    (fields.accountId === null) ===
    (fields.paymentMethodId === null)
  ) {
    issues.push({ path: ['accountId'], message: 'payment_or_account_required' })
  }
  return issues
}

export const createScheduleRequestSchema = scheduleFieldsSchema
  .superRefine((fields, context) => {
    for (const issue of scheduleFieldIssues(fields)) {
      context.addIssue({ code: 'custom', ...issue })
    }
  })
  .meta({ id: 'CreateScheduleRequest' })

export const updateScheduleRequestSchema = z
  .object({
    ...commonShape,
    amountTolerancePct: amountToleranceSchema,
    bankLabelPatterns: bankLabelPatternsSchema,
    tagIds: tagIdsSchema,
    reminderDaysBefore: reminderDaysBeforeSchema,
    ...categorizedShape,
    ...transferShape,
    isSubscription: z.boolean({ error: 'invalid' }),
  })
  .partial()
  .meta({ id: 'UpdateScheduleRequest' })

export const occurrenceStatusSchema = z
  .enum(['pending', 'skipped', 'executed'])
  .meta({ id: 'OccurrenceStatus' })

export const scheduleOccurrenceSchema = z
  .object({
    originalDate: z.iso.date(),
    effectiveDate: z.iso.date(),
    amountCents: z.number().int(),
    status: occurrenceStatusSchema,
    overridden: z.boolean(),
    editable: z.boolean(),
  })
  .meta({ id: 'ScheduleOccurrence' })

export const scheduleCapExcessSchema = z
  .object({
    originalDate: z.iso.date(),
    effectiveDate: z.iso.date(),
    excessCents: z.number().int(),
  })
  .meta({ id: 'ScheduleCapExcess' })

export const scheduleSchema = z
  .object({
    id: z.uuid(),
    kind: scheduleKindSchema,
    label: z.string(),
    amountCents: z.number().int(),
    triggerMode: triggerModeSchema,
    reminderDaysBefore: z.number().int(),
    note: z.string().nullable(),
    active: z.boolean(),
    isSubscription: z.boolean(),
    accountId: z.uuid().nullable(),
    paymentMethodId: z.uuid().nullable(),
    categoryId: z.uuid().nullable(),
    sourceAccountId: z.uuid().nullable(),
    targetAccountId: z.uuid().nullable(),
    frequency: scheduleFrequencySchema,
    interval: z.number().int(),
    startDate: z.iso.date(),
    anchorLastDay: z.boolean(),
    endDate: z.iso.date().nullable(),
    maxOccurrences: z.number().int().nullable(),
    businessDayRule: businessDayRuleSchema,
    amountTolerancePct: z.number().int(),
    bankLabelPatterns: z.array(z.string()),
    tagIds: z.array(z.uuid()),
    createdAt: z.iso.datetime(),
    monthlyEquivalentCents: z.number().int().nullable(),
    nextOccurrence: scheduleOccurrenceSchema.nullable(),
    ended: z.boolean(),
    capExcess: scheduleCapExcessSchema.nullable(),
  })
  .meta({ id: 'Schedule' })

export const scheduleTotalsSchema = z
  .object({
    expensesCents: z.number().int(),
    incomesCents: z.number().int(),
    savingsTransfersCents: z.number().int(),
  })
  .meta({ id: 'ScheduleTotals' })

export const scheduleListResponseSchema = z
  .object({
    schedules: z.array(scheduleSchema),
    totals: scheduleTotalsSchema,
  })
  .meta({ id: 'ScheduleListResponse' })

export const updateScheduleResponseSchema = z
  .object({
    schedule: scheduleSchema,
    removedExceptions: z.number().int(),
  })
  .meta({ id: 'UpdateScheduleResponse' })

export const scheduleOccurrenceListResponseSchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    occurrences: z.array(scheduleOccurrenceSchema),
  })
  .meta({ id: 'ScheduleOccurrenceListResponse' })

export const occurrenceParamsSchema = z.object({
  id: z.uuid(),
  originalDate: z.iso.date(),
})

export const overrideOccurrenceRequestSchema = z
  .object({
    amountCents: positiveAmountCentsSchema.nullable(),
    effectiveDate: isoDateSchema.nullable(),
  })
  .refine(
    (override) =>
      override.amountCents !== null || override.effectiveDate !== null,
    { error: 'override_empty', path: ['amountCents'] },
  )
  .meta({ id: 'OverrideOccurrenceRequest' })

export const subscriptionTotalsSchema = z
  .object({
    monthlyCents: z.number().int(),
    annualCents: z.number().int(),
  })
  .meta({ id: 'SubscriptionTotals' })

export const subscriptionListResponseSchema = z
  .object({
    subscriptions: z.array(scheduleSchema),
    totals: subscriptionTotalsSchema,
  })
  .meta({ id: 'SubscriptionListResponse' })
