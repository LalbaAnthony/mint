<script setup lang="ts">
import { addMonthsToMonth } from '@mint/shared/engines/dates'
import { envelopeMonthResponseSchema } from '@mint/shared/schemas/envelopes'
import type {
  Envelope,
  EnvelopeMonthResponse,
} from '@mint/shared/types/envelopes'

const { t, locale } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const referentials = useReferentialsStore()
const editor = useOperationEditorStore()

const month = ref<string | null>(null)
const result = ref<EnvelopeMonthResponse | null>(null)
const inactiveOpen = ref(false)
const busy = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function load(): Promise<void> {
  try {
    const query = month.value === null ? '' : `?month=${month.value}`
    const [view] = await Promise.all([
      apiGet(`/envelopes${query}`, envelopeMonthResponseSchema),
      referentials.load(),
    ])
    result.value = view
    month.value = view.month
  } catch (error) {
    notifyFailure(error)
  }
}

onMounted(load)
watch(() => editor.savedVersion, load)

function shift(offset: number): Promise<void> {
  if (month.value === null) {
    return Promise.resolve()
  }
  month.value = addMonthsToMonth(month.value, offset)
  return load()
}

const monthLabel = computed(() =>
  month.value === null
    ? ''
    : new Intl.DateTimeFormat(locale.value, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(new Date(`${month.value}T00:00:00Z`)),
)

const isCurrentMonth = computed(
  () =>
    result.value !== null && result.value.month === result.value.currentMonth,
)

const takenCategoryIds = computed(() =>
  [
    ...(result.value?.lines.map((line) => line.envelope) ?? []),
    ...(result.value?.inactive ?? []),
  ].flatMap((envelope) => envelope.categoryIds),
)

const formOpen = ref(false)
const editedEnvelope = ref<Envelope | null>(null)

function openForm(envelope: Envelope | null): void {
  editedEnvelope.value = envelope
  formOpen.value = true
}

async function saved(envelope: Envelope): Promise<void> {
  toast.add({
    title: t('envelopes.saved', { label: envelope.label }),
    icon: icons.success,
    color: 'success',
  })
  await load()
}

const envelopeToDelete = ref<Envelope | null>(null)
const deleteOpen = computed({
  get: () => envelopeToDelete.value !== null,
  set: (open) => {
    if (!open) {
      envelopeToDelete.value = null
    }
  },
})

async function deleteEnvelope(): Promise<void> {
  const envelope = envelopeToDelete.value
  if (envelope === null) {
    return
  }
  busy.value = true
  try {
    await apiCommand('DELETE', `/envelopes/${envelope.id}`)
    envelopeToDelete.value = null
    await load()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <ViewPanel :title="t('navigation.envelopes')">
    <template #actions>
      <OfflineGuard v-slot="{ offline }">
        <UButton
          :disabled="offline"
          :icon="icons.add"
          :aria-label="t('envelopes.add')"
          color="primary"
          variant="soft"
          data-testid="envelopes-add"
          @click="openForm(null)"
        >
          <span class="max-sm:sr-only">{{ t('envelopes.add') }}</span>
        </UButton>
      </OfflineGuard>
    </template>

    <div v-if="result !== null" class="flex flex-col gap-4">
      <UCard>
        <div class="flex items-center justify-between gap-2">
          <UButton
            :icon="icons.previous"
            :aria-label="t('envelopes.previousMonth')"
            color="neutral"
            variant="ghost"
            data-testid="envelopes-previous"
            @click="shift(-1)"
          />
          <p
            class="text-base font-semibold text-highlighted first-letter:uppercase"
            data-testid="envelopes-month"
          >
            {{ monthLabel }}
          </p>
          <UButton
            :icon="icons.next"
            :aria-label="t('envelopes.nextMonth')"
            color="neutral"
            variant="ghost"
            data-testid="envelopes-next"
            @click="shift(1)"
          />
        </div>
        <p
          v-if="isCurrentMonth && result.remainingDays !== null"
          class="text-center text-xs text-muted"
        >
          {{
            t(
              'envelopes.remainingDays',
              { n: result.remainingDays },
              result.remainingDays,
            )
          }}
        </p>
      </UCard>

      <UCard v-if="result.lines.length === 0">
        <EmptyState
          :icon="icons.envelopes"
          :title="t('envelopes.emptyTitle')"
          :description="t('envelopes.emptyText')"
        >
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              :label="t('envelopes.add')"
              :icon="icons.add"
              color="primary"
              variant="soft"
              @click="openForm(null)"
            />
          </OfflineGuard>
        </EmptyState>
      </UCard>
      <div
        v-else
        class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3"
        data-testid="envelopes-list"
      >
        <EnvelopeCard
          v-for="line in result.lines"
          :key="line.envelope.id"
          :line="line"
          :current-month="isCurrentMonth"
          @edit="openForm"
          @delete="envelopeToDelete = $event"
        />
      </div>

      <UCard v-if="result.inactive.length > 0">
        <UCollapsible v-model:open="inactiveOpen">
          <UButton
            :label="
              t('envelopes.inactiveSection', { n: result.inactive.length })
            "
            :icon="inactiveOpen ? icons.collapse : icons.expand"
            color="neutral"
            variant="ghost"
            block
            class="justify-start"
          />
          <template #content>
            <ul class="flex flex-col divide-y divide-default pt-2">
              <li
                v-for="envelope in result.inactive"
                :key="envelope.id"
                class="flex items-center gap-2 py-2"
              >
                <span class="min-w-0 flex-1 truncate text-sm text-muted">
                  {{ envelope.label }}
                </span>
                <OfflineGuard v-slot="{ offline }">
                  <UButton
                    :disabled="offline"
                    :label="t('common.edit')"
                    color="neutral"
                    variant="ghost"
                    @click="openForm(envelope)"
                  />
                </OfflineGuard>
              </li>
            </ul>
          </template>
        </UCollapsible>
      </UCard>
    </div>

    <EnvelopeFormModal
      v-model:open="formOpen"
      :envelope="editedEnvelope"
      :taken-category-ids="takenCategoryIds"
      @saved="saved"
    />

    <ConfirmModal
      v-model:open="deleteOpen"
      :title="t('envelopes.deleteTitle')"
      :description="
        t('envelopes.deleteEffect', { label: envelopeToDelete?.label ?? '' })
      "
      :confirm-label="t('common.delete')"
      :pending="busy"
      @confirm="deleteEnvelope"
    />
  </ViewPanel>
</template>
