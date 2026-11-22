import type { Account } from '@mint/shared/types/accounts'
import type { Envelope } from '@mint/shared/types/envelopes'
import type { Operation } from '@mint/shared/types/operations'
import type { Schedule } from '@mint/shared/types/schedules'
import type { SearchTarget } from '~~/types/search'

function joined(parts: readonly (string | null)[]): string {
  return parts
    .filter((part): part is string => part !== null && part !== '')
    .join(' · ')
}

export function useSearchResults() {
  const { t } = useI18n()
  const { formatDate } = useFormatters()
  const router = useRouter()
  const referentials = useReferentialsStore()
  const editor = useOperationEditorStore()
  const labels = usePlanningLabels()

  function accountDetail(account: Account): string {
    const nature = t(`accounts.natures.${account.nature}`)
    return joined([
      account.institution,
      account.regulatedProduct === null
        ? nature
        : t('accounts.natureWithProduct', {
            nature,
            product: t(`accounts.products.${account.regulatedProduct}`),
          }),
    ])
  }

  function operationDetail(operation: Operation): string {
    return joined([
      formatDate(operation.date),
      operation.transferGroupId === null
        ? referentials.categoryName(operation.categoryId)
        : t('operations.transferWith', {
            account: referentials.accountName(operation.counterpartAccountId),
          }),
      referentials.accountName(operation.accountId),
    ])
  }

  function scheduleDetail(schedule: Schedule): string {
    return joined([
      labels.kindLabel(schedule.kind),
      labels.recurrenceLabel(schedule),
      schedule.nextOccurrence === null
        ? null
        : t('search.nextOccurrence', {
            date: formatDate(schedule.nextOccurrence.effectiveDate),
          }),
    ])
  }

  function scheduleCents(schedule: Schedule): number {
    return schedule.kind === 'expense'
      ? -schedule.amountCents
      : schedule.amountCents
  }

  function scheduleBadge(schedule: Schedule): string | null {
    if (!schedule.active) {
      return t('schedules.inactive')
    }
    return schedule.ended ? t('schedules.ended') : null
  }

  function envelopeDetail(envelope: Envelope): string {
    return labels.envelopeSourceLabel(envelope)
  }

  async function open(target: SearchTarget): Promise<void> {
    switch (target.kind) {
      case 'account':
        await router.push({
          path: '/accounts',
          query: { account: target.account.id },
        })
        return
      case 'operation':
        editor.edit(target.operation)
        return
      case 'schedule':
        await router.push({
          path: '/schedules',
          query: { schedule: target.schedule.id },
        })
        return
      case 'envelope':
        await router.push({
          path: '/envelopes',
          query: { envelope: target.envelope.envelope.id },
        })
    }
  }

  return {
    accountDetail,
    operationDetail,
    scheduleDetail,
    scheduleCents,
    scheduleBadge,
    envelopeDetail,
    open,
  }
}
