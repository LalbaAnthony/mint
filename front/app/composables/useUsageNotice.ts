import { usageCountsSchema } from '@mint/shared/schemas/usage'
import type { UsageCounts } from '@mint/shared/types/operations'
import type { UsageNotice } from '~~/types/planning'

export function useUsageNotice() {
  const { t } = useI18n()

  function loadUsage(path: string): Promise<UsageCounts> {
    return apiGet(`${path}/usage`, usageCountsSchema)
  }

  function references(usage: UsageCounts): string {
    return [
      usage.operations > 0
        ? t('usage.operations', { n: usage.operations }, usage.operations)
        : null,
      usage.schedules > 0
        ? t('usage.schedules', { n: usage.schedules }, usage.schedules)
        : null,
      usage.envelopes > 0
        ? t('usage.envelopes', { n: usage.envelopes }, usage.envelopes)
        : null,
      usage.rules > 0
        ? t('usage.rules', { n: usage.rules }, usage.rules)
        : null,
    ]
      .filter((part): part is string => part !== null)
      .join(', ')
  }

  function accountNotice(
    usage: UsageCounts | null,
    name: string,
    freeDescription: string,
  ): UsageNotice {
    if (usage === null) {
      return { blocked: true, description: t('usage.checking') }
    }
    if (usage.operations > 0) {
      return {
        blocked: true,
        description: t('accounts.deleteBlockedOperations', { name }),
      }
    }
    if (usage.schedules + usage.envelopes + usage.rules > 0) {
      return {
        blocked: true,
        description: t('accounts.deleteBlockedUsage', {
          name,
          references: references(usage),
        }),
      }
    }
    return { blocked: false, description: freeDescription }
  }

  function paymentMethodNotice(
    usage: UsageCounts | null,
    label: string,
  ): UsageNotice {
    if (usage === null) {
      return { blocked: true, description: t('usage.checking') }
    }
    if (usage.operations + usage.schedules + usage.envelopes > 0) {
      return {
        blocked: true,
        description: t('paymentMethods.deleteBlocked', {
          label,
          references: references(usage),
        }),
      }
    }
    return {
      blocked: false,
      description: t('paymentMethods.deleteEffect', { label }),
    }
  }

  return { loadUsage, references, accountNotice, paymentMethodNotice }
}
