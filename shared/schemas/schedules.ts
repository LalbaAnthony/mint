import { z } from 'zod'

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
