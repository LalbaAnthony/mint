import type { z } from 'zod'
import type {
  acceptInvitationFormSchema,
  changePasswordFormSchema,
} from '../schemas/forms'
import type { AllocationTargets, Locale } from '@mint/shared/types/user'

export type AcceptInvitationFormState = z.input<
  typeof acceptInvitationFormSchema
>

export type ChangePasswordFormState = z.input<typeof changePasswordFormSchema>

export type ProfileFormState = {
  locale: Locale
  forecastHorizonMonths: number
  targets: Record<keyof AllocationTargets, number | null>
}

export type SelectItem<Value> = {
  label: string
  value: Value
}
