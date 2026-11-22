<script setup lang="ts">
import {
  regulatedCapListResponseSchema,
  regulatedCapSchema,
} from '@mint/shared/schemas/accounts'
import type { RegulatedCap } from '@mint/shared/types/accounts'
import { regulatedCapFormSchema } from '~~/schemas/forms'

const { t, locale } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()

const caps = ref<RegulatedCap[]>([])
const drafts = reactive<Record<string, string>>({})
const saving = ref<string | null>(null)

const loadState = useLoadState({
  onError: (error) =>
    toast.add({
      title: errorMessage(error),
      icon: icons.error,
      color: 'error',
    }),
})

async function fetchCaps(): Promise<void> {
  caps.value = await apiGet('/regulated-caps', regulatedCapListResponseSchema)
  for (const cap of caps.value) {
    drafts[cap.product] = formatAmountInput(cap.capCents, locale.value)
  }
}

function load(): Promise<void> {
  return loadState.run(fetchCaps, 'background')
}

function updateDraft(product: RegulatedCap['product'], text: string): void {
  drafts[product] = text
}

async function save(cap: RegulatedCap): Promise<void> {
  const parsed = regulatedCapFormSchema(locale.value).safeParse({
    cap: drafts[cap.product] ?? '',
  })
  if (!parsed.success || parsed.data.cap === null) {
    toast.add({
      title: t('validation.invalid_amount'),
      icon: icons.error,
      color: 'error',
    })
    return
  }
  saving.value = cap.product
  try {
    await apiCall(
      'PATCH',
      `/admin/regulated-caps/${cap.product}`,
      regulatedCapSchema,
      { capCents: parsed.data.cap },
    )
    toast.add({
      title: t('admin.caps.saved', {
        product: t(`accounts.products.${cap.product}`),
      }),
      icon: icons.success,
      color: 'success',
    })
    await load()
  } catch (error) {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    saving.value = null
  }
}

onMounted(() => loadState.run(fetchCaps))

const skeletonRows = useRememberedCount(
  'admin.caps',
  loadState,
  () => caps.value.length,
)
</script>

<template>
  <UCard data-testid="regulated-caps">
    <template #header>
      <h2 class="text-base font-semibold text-highlighted">
        {{ t('admin.caps.title') }}
      </h2>
      <p class="text-sm text-muted">{{ t('admin.caps.help') }}</p>
    </template>
    <LoadZone :state="loadState">
      <template #skeleton>
        <SkeletonList
          :count="skeletonRows"
          :row="{ wrap: true, align: 'end' }"
          class="flex flex-col divide-y divide-default"
        >
          <SkeletonFormField class="min-w-48 flex-1" />
          <SkeletonControl kind="button" class="w-28" />
        </SkeletonList>
      </template>
      <ul class="flex flex-col divide-y divide-default">
        <ListRow
          v-for="cap in caps"
          :key="cap.product"
          wrap
          align="end"
          :data-testid="`regulated-cap-${cap.product}`"
        >
          <AppFormField
            :label="t(`accounts.products.${cap.product}`)"
            :name="cap.product"
            class="min-w-48 flex-1"
          >
            <AmountInput
              :model-value="drafts[cap.product] ?? ''"
              @update:model-value="(text) => updateDraft(cap.product, text)"
            />
          </AppFormField>
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              :label="t('common.save')"
              color="primary"
              variant="soft"
              :loading="saving === cap.product"
              :data-testid="`regulated-cap-save-${cap.product}`"
              @click="save(cap)"
            />
          </OfflineGuard>
        </ListRow>
      </ul>
    </LoadZone>
  </UCard>
</template>
