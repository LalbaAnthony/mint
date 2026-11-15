import type { Account } from '@mint/shared/types/accounts'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import type {
  PaymentSource,
  PaymentSourceItem,
  PaymentSourceValue,
} from '~~/types/planning'

export function paymentSourceValue(
  accountId: string | null,
  paymentMethodId: string | null,
): PaymentSourceValue | undefined {
  if (paymentMethodId !== null) {
    return `method:${paymentMethodId}`
  }
  return accountId === null ? undefined : `account:${accountId}`
}

export function toPaymentSource(value: PaymentSourceValue): PaymentSource {
  return value.startsWith('method:')
    ? { accountId: null, paymentMethodId: value.slice('method:'.length) }
    : { accountId: value.slice('account:'.length), paymentMethodId: null }
}

export function sourceAccountId(
  value: PaymentSourceValue,
  paymentMethods: readonly PaymentMethod[],
): string | null {
  const source = toPaymentSource(value)
  if (source.accountId !== null) {
    return source.accountId
  }
  return (
    paymentMethods.find(
      (paymentMethod) => paymentMethod.id === source.paymentMethodId,
    )?.accountId ?? null
  )
}

export function paymentSourceItems(
  accounts: readonly Account[],
  paymentMethods: readonly PaymentMethod[],
  kept: PaymentSourceValue | undefined,
): PaymentSourceItem[] {
  return accounts.flatMap((account) => {
    const accountValue: PaymentSourceValue = `account:${account.id}`
    const accountItems: PaymentSourceItem[] =
      account.archivedAt === null || kept === accountValue
        ? [{ label: account.name, value: accountValue }]
        : []
    const methodItems = paymentMethods
      .filter((paymentMethod) => paymentMethod.accountId === account.id)
      .flatMap((paymentMethod): PaymentSourceItem[] => {
        const value: PaymentSourceValue = `method:${paymentMethod.id}`
        const usable =
          paymentMethod.archivedAt === null && account.archivedAt === null
        return usable || kept === value
          ? [{ label: `${paymentMethod.label} (${account.name})`, value }]
          : []
      })
    return [...accountItems, ...methodItems]
  })
}
