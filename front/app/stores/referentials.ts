import { accountOverviewSchema } from '@mint/shared/schemas/accounts'
import { categoryListResponseSchema } from '@mint/shared/schemas/categories'
import { paymentMethodListResponseSchema } from '@mint/shared/schemas/payment-methods'
import { tagListResponseSchema, tagSchema } from '@mint/shared/schemas/tags'
import type { Account } from '@mint/shared/types/accounts'
import type { Category } from '@mint/shared/types/categories'
import type { PaymentMethod } from '@mint/shared/types/payment-methods'
import type { Tag } from '@mint/shared/types/tags'

export const useReferentialsStore = defineStore('referentials', () => {
  const accounts = ref<Account[]>([])
  const paymentMethods = ref<PaymentMethod[]>([])
  const categories = ref<Category[]>([])
  const tags = ref<Tag[]>([])

  async function load(): Promise<void> {
    const [overview, methods, loadedCategories, loadedTags] = await Promise.all(
      [
        apiGet('/accounts/overview', accountOverviewSchema),
        apiGet('/payment-methods', paymentMethodListResponseSchema),
        apiGet('/categories', categoryListResponseSchema),
        apiGet('/tags', tagListResponseSchema),
      ],
    )
    accounts.value = [
      ...overview.groups.flatMap((group) => group.accounts),
      ...overview.archived,
    ]
    paymentMethods.value = methods
    categories.value = loadedCategories
    tags.value = loadedTags
  }

  async function loadTags(): Promise<void> {
    tags.value = await apiGet('/tags', tagListResponseSchema)
  }

  async function createTag(name: string): Promise<Tag> {
    const tag = await apiCall('POST', '/tags', tagSchema, { name })
    if (!tags.value.some((existing) => existing.id === tag.id)) {
      tags.value = [...tags.value, tag].sort((first, second) =>
        first.name.localeCompare(second.name),
      )
    }
    return tag
  }

  function tagsOf(ids: readonly string[]): Tag[] {
    return tags.value.filter((tag) => ids.includes(tag.id))
  }

  const activeAccounts = computed(() =>
    accounts.value.filter((account) => account.archivedAt === null),
  )

  const session = useSessionStore()

  const defaultAccountId = computed(() => {
    const id = session.user?.defaultAccountId ?? null
    return activeAccounts.value.some((account) => account.id === id) ? id : null
  })

  const prefilledAccountId = computed(() => {
    if (defaultAccountId.value !== null) {
      return defaultAccountId.value
    }
    const [only, ...others] = activeAccounts.value
    return only !== undefined && others.length === 0 ? only.id : null
  })

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
    tags,
    activeAccounts,
    defaultAccountId,
    prefilledAccountId,
    load,
    loadTags,
    createTag,
    tagsOf,
    accountName,
    paymentMethodLabel,
    categoryName,
  }
})
