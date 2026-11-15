import { accountOverviewSchema } from '@mint/shared/schemas/accounts'
import { categoryListResponseSchema } from '@mint/shared/schemas/categories'
import { paymentMethodListResponseSchema } from '@mint/shared/schemas/payment-methods'
import type { Account } from '@mint/shared/types/accounts'
import type { Category } from '@mint/shared/types/categories'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'

export const useReferentialsStore = defineStore('referentials', () => {
  const accounts = ref<Account[]>([])
  const paymentMethods = ref<PaymentMethod[]>([])
  const categories = ref<Category[]>([])

  async function load(): Promise<void> {
    const [overview, methods, loadedCategories] = await Promise.all([
      apiGet('/accounts/overview', accountOverviewSchema),
      apiGet('/payment-methods', paymentMethodListResponseSchema),
      apiGet('/categories', categoryListResponseSchema),
    ])
    accounts.value = [
      ...overview.groups.flatMap((group) => group.accounts),
      ...overview.archived,
    ]
    paymentMethods.value = methods
    categories.value = loadedCategories
  }

  const activeAccounts = computed(() =>
    accounts.value.filter((account) => account.archivedAt === null),
  )

  function accountName(id: string | null): string {
    return accounts.value.find((account) => account.id === id)?.name ?? ''
  }

  function paymentMethodLabel(id: string | null): string {
    return (
      paymentMethods.value.find((paymentMethod) => paymentMethod.id === id)
        ?.label ?? ''
    )
  }

  function categoryName(id: string | null): string {
    const category = categories.value.find((candidate) => candidate.id === id)
    if (category === undefined) {
      return ''
    }
    const parent = categories.value.find(
      (candidate) => candidate.id === category.parentId,
    )
    return parent === undefined
      ? category.name
      : `${parent.name} › ${category.name}`
  }

  return {
    accounts,
    paymentMethods,
    categories,
    activeAccounts,
    load,
    accountName,
    paymentMethodLabel,
    categoryName,
  }
})
