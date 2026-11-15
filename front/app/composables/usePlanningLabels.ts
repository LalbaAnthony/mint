import type { Envelope } from '@mint/shared/types/envelopes'
import type {
  BusinessDayRule,
  Schedule,
  ScheduleKind,
} from '@mint/shared/types/schedules'

export function usePlanningLabels() {
  const { t } = useI18n()
  const referentials = useReferentialsStore()

  function recurrenceLabel(
    schedule: Pick<Schedule, 'frequency' | 'interval' | 'anchorLastDay'>,
  ): string {
    const base = t(
      `recurrence.${schedule.frequency}`,
      { n: schedule.interval },
      schedule.interval,
    )
    return schedule.anchorLastDay
      ? `${base}, ${t('recurrence.lastDaySuffix')}`
      : base
  }

  function businessDayLabel(rule: BusinessDayRule): string {
    return t(`schedules.businessDayRules.${rule}`)
  }

  function kindLabel(kind: ScheduleKind): string {
    return t(`schedules.kinds.${kind}`)
  }

  function scheduleSourceLabel(schedule: Schedule): string {
    if (schedule.kind === 'transfer') {
      return `${referentials.accountName(schedule.sourceAccountId)} → ${referentials.accountName(schedule.targetAccountId)}`
    }
    return schedule.paymentMethodId === null
      ? referentials.accountName(schedule.accountId)
      : referentials.paymentMethodLabel(schedule.paymentMethodId)
  }

  function envelopeSourceLabel(envelope: Envelope): string {
    return envelope.paymentMethodId === null
      ? referentials.accountName(envelope.accountId)
      : referentials.paymentMethodLabel(envelope.paymentMethodId)
  }

  return {
    recurrenceLabel,
    businessDayLabel,
    kindLabel,
    scheduleSourceLabel,
    envelopeSourceLabel,
  }
}
