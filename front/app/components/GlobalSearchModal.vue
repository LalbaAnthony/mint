<script setup lang="ts">
import { searchPreviewSize } from '@mint/shared/schemas/search'
import type { SearchResponse } from '@mint/shared/types/search'
import type {
  SearchPreviewGroup,
  SearchPreviewItem,
  SearchTarget,
} from '~~/types/search'

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const router = useRouter()
const search = useSearchStore()
const referentials = useReferentialsStore()
const results = useSearchResults()
const { text, result, state, loading, searchable, reset } = useGlobalSearch({
  operationsLimit: searchPreviewSize,
})

async function loadReferentials(): Promise<void> {
  if (referentials.categories.length > 0) {
    return
  }
  try {
    await referentials.load()
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  }
}

watch(
  () => search.modalOpen,
  (open) => {
    text.value = ''
    reset()
    if (open) {
      void loadReferentials()
    }
  },
)

async function choose(target: SearchTarget): Promise<void> {
  search.closeModal()
  await results.open(target)
}

async function showAll(): Promise<void> {
  const query = text.value
  search.closeModal()
  await router.push(searchPageLocation(query))
}

function sectionLabel(key: string, n: number): string {
  return t('search.sectionCount', { section: t(`navigation.${key}`), n })
}

function accountItems(response: SearchResponse): SearchPreviewItem[] {
  return response.accounts.slice(0, searchPreviewSize).map((account) => ({
    label: account.name,
    suffix: account.archivedAt === null ? undefined : t('common.archived'),
    description: results.accountDetail(account),
    icon: icons.accounts,
    amount: {
      cents: account.currentBalanceCents,
      variant: 'balance',
      threshold: account.lowBalanceThresholdCents,
      concealable: true,
    },
    onSelect: () => void choose({ kind: 'account', account }),
  }))
}

function operationItems(response: SearchResponse): SearchPreviewItem[] {
  return response.operations.items
    .slice(0, searchPreviewSize)
    .map((operation) => ({
      label: operation.label,
      description: results.operationDetail(operation),
      icon: originIcon(operation),
      amount: {
        cents: operation.amountCents,
        variant: 'flow',
        threshold: null,
        concealable: false,
      },
      onSelect: () => void choose({ kind: 'operation', operation }),
    }))
}

function scheduleItems(response: SearchResponse): SearchPreviewItem[] {
  return response.schedules.slice(0, searchPreviewSize).map((schedule) => ({
    label: schedule.label,
    suffix: results.scheduleBadge(schedule) ?? undefined,
    description: results.scheduleDetail(schedule),
    icon: icons[schedule.kind],
    amount: {
      cents: results.scheduleCents(schedule),
      variant: 'flow',
      threshold: null,
      concealable: false,
    },
    onSelect: () => void choose({ kind: 'schedule', schedule }),
  }))
}

function envelopeItems(response: SearchResponse): SearchPreviewItem[] {
  return response.envelopes.slice(0, searchPreviewSize).map((line) => ({
    label: line.envelope.label,
    suffix: line.status === null ? t('schedules.inactive') : undefined,
    description: results.envelopeDetail(line.envelope),
    icon: icons.envelopes,
    amount: {
      cents:
        line.status === null
          ? line.envelope.monthlyAmountCents
          : line.status.availableCents,
      variant: 'balance',
      threshold: null,
      concealable: true,
    },
    onSelect: () => void choose({ kind: 'envelope', envelope: line }),
  }))
}

const seeAllGroup = computed<SearchPreviewGroup>(() => ({
  id: 'all',
  ignoreFilter: true,
  items: [
    {
      label: t('search.seeAll', { text: text.value.trim() }),
      icon: icons.search,
      onSelect: () => void showAll(),
    },
  ],
}))

const previewLoading = computed(() => state.phase === 'skeleton')

const groups = computed<SearchPreviewGroup[]>(() => {
  if (!searchable.value) {
    return []
  }
  const response = result.value
  if (response === null || previewLoading.value) {
    return [seeAllGroup.value]
  }
  const sections: SearchPreviewGroup[] = [
    {
      id: 'accounts',
      label: sectionLabel('accounts', response.accounts.length),
      ignoreFilter: true,
      items: accountItems(response),
    },
    {
      id: 'operations',
      label: sectionLabel('operations', response.operations.total),
      ignoreFilter: true,
      items: operationItems(response),
    },
    {
      id: 'schedules',
      label: sectionLabel('schedules', response.schedules.length),
      ignoreFilter: true,
      items: scheduleItems(response),
    },
    {
      id: 'envelopes',
      label: sectionLabel('envelopes', response.envelopes.length),
      ignoreFilter: true,
      items: envelopeItems(response),
    },
  ]
  return [
    seeAllGroup.value,
    ...sections.filter((group) => (group.items?.length ?? 0) > 0),
  ]
})

const noResult = computed(
  () =>
    !previewLoading.value && groups.value.length === 1 && result.value !== null,
)
</script>

<template>
  <UModal
    v-model:open="search.modalOpen"
    :title="t('search.title')"
    :description="t('search.description')"
    class="h-full sm:h-[28rem] sm:max-w-2xl"
  >
    <template #content>
      <UCommandPalette
        v-model:search-term="text"
        :groups="groups"
        :loading="loading"
        :placeholder="t('search.placeholder')"
        close
        class="h-full"
        data-testid="search-palette"
        @update:open="search.modalOpen = $event"
      >
        <template #item-trailing="{ item }">
          <MoneyAmount
            v-if="item.amount !== undefined"
            v-bind="item.amount"
            class="text-sm font-medium"
          />
        </template>
        <template #empty>
          <p class="text-sm text-muted" data-testid="search-hint">
            {{ t('search.hint') }}
          </p>
        </template>
        <template v-if="previewLoading" #footer>
          <SkeletonZone class="px-2 pb-2">
            <SkeletonDetailList
              leading
              actions="none"
              :row="{ gap: 3, padding: 1.5 }"
            />
          </SkeletonZone>
        </template>
        <template v-else-if="noResult" #footer>
          <p
            class="py-6 text-center text-sm text-muted"
            data-testid="search-no-result"
          >
            {{ t('search.noResultFor', { text: text.trim() }) }}
          </p>
        </template>
      </UCommandPalette>
    </template>
  </UModal>
</template>
