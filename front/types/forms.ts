import type { z } from 'zod'
import type {
  acceptInvitationFormSchema,
  accountFormSchema,
  changePasswordFormSchema,
} from '../schemas/forms'
import type {
  AccountNature,
  AccountUsage,
  RegulatedProduct,
} from '@mint/shared/types/accounts'
import type {
  EditableCategoryKind,
  ExpenseGroup,
} from '@mint/shared/types/categories'
import type { PaymentMethodKind } from '@mint/shared/types/payment-methods'
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

export type AccountFormState = {
  name: string
  nature: AccountNature
  regulatedProduct: RegulatedProduct | null
  usage: AccountUsage
  institution: string
  initialBalance: string
  initialBalanceDate: string
  lowBalanceThreshold: string
}

export type AccountFormOutput = z.output<ReturnType<typeof accountFormSchema>>

export type PaymentMethodFormState = {
  label: string
  kind: PaymentMethodKind
  accountId: string | undefined
}

export type CategoryFormState = {
  name: string
  kind: EditableCategoryKind
  expenseGroup: ExpenseGroup | null
  parentId: string | null
}

export type TagFormState = {
  name: string
}
