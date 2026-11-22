<script setup lang="ts">
import { watchDebounced } from '@vueuse/core'
import { searchOperationsBatch } from '@mint/shared/schemas/search'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const toast = useToast()
const { errorMessage } = useFormValidation()
const connectivity = useConnectivityStore()
const referentials = useReferentialsStore()
const editor = useOperationEditorStore()

function queryText(): string {
  const q = route.query.q
  return typeof q === 'string' ? q.trim() : ''
}

const initialText = queryText()

const {
  text,
  result,
  loading,
  loadingMore,
  searchable,
  hasMore,
  runNow,
  loadMore,
} = useGlobalSearch({
  operationsLimit: searchOperationsBatch,
  initialText,
})

watchDebounced(
  text,
  (value) => {
    const q = value.trim()
    if (q !== queryText()) {
      void router.replace({ query: q === '' ? {} : { q } })
    }
  },
  { debounce: 300 },
)

watch(
  () => route.query.q,
  () => {
    const q = queryText()
    if (q !== text.value.trim()) {
      text.value = q
    }
  },
)

watch(() => editor.savedVersion, runNow)
watch(
  () => connectivity.offline,
  (offline) => {
    if (!offline) {
      void runNow()
    }
  },
)

onMounted(async () => {
  try {
    await referentials.load()
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  }
  await runNow()
})

const hasResults = computed(
  () =>
    result.value !== null &&
    (result.value.accounts.length > 0 ||
      result.value.operations.total > 0 ||
      result.value.schedules.length > 0 ||
      result.value.envelopes.length > 0),
)
</script>

<template>
  <ViewPanel :title="t('search.pageTitle')">
    <div class="flex flex-col gap-6">
      <form
        role="search"
        class="flex w-full max-w-2xl"
        data-testid="search-form"
        @submit.prevent="runNow"
      >
        <UFieldGroup class="w-full">
          <UInput
            v-model="text"
            type="search"
            :placeholder="t('search.placeholder')"
            :aria-label="t('search.open')"
            :disabled="connectivity.offline"
            :loading="loading"
            :autofocus="initialText === ''"
            color="neutral"
            variant="outline"
            class="min-w-0 flex-1"
            data-testid="search-input"
          />
          <UButton
            type="submit"
            :icon="icons.search"
            :aria-label="t('search.submit')"
            :disabled="connectivity.offline"
            color="neutral"
            variant="soft"
            data-testid="search-submit"
          />
        </UFieldGroup>
      </form>

      <UCard v-if="connectivity.offline">
        <EmptyState
          :icon="icons.offline"
          :title="t('search.offline')"
          :description="t('search.offlineText')"
        />
      </UCard>
      <p
        v-else-if="!searchable"
        class="text-sm text-muted"
        data-testid="search-hint"
      >
        {{ t('search.hint') }}
      </p>
      <UCard v-else-if="result !== null && !hasResults">
        <EmptyState
          :icon="icons.search"
          :title="t('search.noResultTitle')"
          :description="t('search.noResultFor', { text: text.trim() })"
        />
      </UCard>
      <template v-else-if="result !== null">
        <SearchSectionCard
          v-if="result.accounts.length > 0"
          section="accounts"
          :total="result.accounts.length"
        >
          <SearchAccountRow
            v-for="account in result.accounts"
            :key="account.id"
            :account="account"
          />
        </SearchSectionCard>
        <SearchSectionCard
          v-if="result.operations.total > 0"
          section="operations"
          :total="result.operations.total"
        >
          <SearchOperationRow
            v-for="operation in result.operations.items"
            :key="operation.id"
            :operation="operation"
          />
          <template v-if="hasMore" #footer>
            <div class="border-t border-default p-3">
              <UButton
                :label="t('search.more')"
                :loading="loadingMore"
                color="neutral"
                variant="outline"
                block
                data-testid="search-more"
                @click="loadMore"
              />
            </div>
          </template>
        </SearchSectionCard>
        <SearchSectionCard
          v-if="result.schedules.length > 0"
          section="schedules"
          :total="result.schedules.length"
        >
          <SearchScheduleRow
            v-for="schedule in result.schedules"
            :key="schedule.id"
            :schedule="schedule"
          />
        </SearchSectionCard>
        <SearchSectionCard
          v-if="result.envelopes.length > 0"
          section="envelopes"
          :total="result.envelopes.length"
        >
          <SearchEnvelopeRow
            v-for="line in result.envelopes"
            :key="line.envelope.id"
            :result="line"
          />
        </SearchSectionCard>
      </template>
    </div>
  </ViewPanel>
</template>
