import type { DropdownMenuItem } from '@nuxt/ui'
import type { EnvelopeActionHandlers } from '~~/types/planning'

export function useEnvelopeActions() {
  const { t } = useI18n()
  const connectivity = useConnectivityStore()

  return (handlers: EnvelopeActionHandlers): DropdownMenuItem[][] => [
    [
      {
        label: t('envelopes.monthAmount'),
        icon: icons.monthAmount,
        disabled: connectivity.offline,
        onSelect: handlers.monthAmount,
      },
      {
        label: t('common.edit'),
        icon: icons.edit,
        disabled: connectivity.offline,
        onSelect: handlers.edit,
      },
    ],
    [
      {
        label: t('common.delete'),
        icon: icons.delete,
        color: 'error',
        disabled: connectivity.offline,
        onSelect: handlers.delete,
      },
    ],
  ]
}
