<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { DropdownMenuItem, TableColumn } from '@nuxt/ui'
import { addMonthsToMonth } from '@mint/shared/engines/dates'
import { envelopeMonthResponseSchema } from '@mint/shared/schemas/envelopes'
import type {
  Envelope,
  EnvelopeMonthLine,
  EnvelopeMonthResponse,
} from '@mint/shared/types/envelopes'

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatMonth } = useFormatters()
const { money, spokenMoney } = useAmountMask()
const referentials = useReferentialsStore()
const editor = useOperationEditorStore()
const labels = usePlanningLabels()
const envelopeActions = useEnvelopeActions()
const isDesktop = useMediaQuery('(min-width: 1024px)')

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
  month.value === null ? '' : formatMonth(month.value),
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

const columns = computed<TableColumn<EnvelopeMonthLine>[]>(() => [
  { id: 'label', header: t('envelopes.fields.label') },
  { id: 'budget', header: t('envelopes.budget') },
  { id: 'carriedOver', header: t('envelopes.carriedOver') },
  { id: 'consumed', header: t('envelopes.consumed') },
  { id: 'available', header: t('envelopes.available') },
  ...(isCurrentMonth.value
    ? [{ id: 'perDay', header: t('envelopes.perRemainingDay') }]
    : []),
  { id: 'actions', header: '' },
])

function actionsOf(line: EnvelopeMonthLine): DropdownMenuItem[][] {
  return envelopeActions({
    monthAmount: () => openMonthAmount(line),
    edit: () => openForm(line.envelope),
    delete: () => {
      envelopeToDelete.value = line.envelope
    },
  })
}

const monthAmountOpen = ref(false)
const monthAmountLine = ref<EnvelopeMonthLine | null>(null)

function openMonthAmount(line: EnvelopeMonthLine): void {
  monthAmountLine.value = line
  monthAmountOpen.value = true
}

async function monthAmountSaved(label: string): Promise<void> {
  toast.add({
    title: t('envelopes.monthAmountSaved', { label, month: monthLabel.value }),
    icon: icons.success,
    color: 'success',
  })
  await load()
}

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
      <UCard v-else data-testid="envelopes-list">
        <UTable
          v-if="isDesktop"
          :data="result.lines"
          :columns="columns"
          :ui="{ th: 'whitespace-nowrap', td: 'align-top' }"
          data-testid="envelopes-table"
        >
          <template #label-cell="{ row }">
            <div
              class="flex min-w-0 flex-col"
              :data-testid="`envelope-${row.original.envelope.id}`"
            >
              <span class="font-medium text-highlighted">
                {{ row.original.envelope.label }}
              </span>
              <span class="text-xs text-muted">
                {{ labels.envelopeSourceLabel(row.original.envelope) }}
              </span>
            </div>
          </template>
          <template #budget-cell="{ row }">
            <div class="text-right">
              <EnvelopeBudget :line="row.original" />
            </div>
          </template>
          <template #carriedOver-cell="{ row }">
            <div class="text-right">
              <MoneyAmount
                :cents="row.original.status.carriedOverCents"
                variant="flow"
                concealable
              />
            </div>
          </template>
          <template #consumed-cell="{ row }">
            <EnvelopeConsumption :status="row.original.status" />
          </template>
          <template #available-cell="{ row }">
            <div class="text-right">
              <MoneyAmount
                :cents="row.original.status.availableCents"
                concealable
                data-testid="envelope-available"
              />
            </div>
          </template>
          <template #perDay-cell="{ row }">
            <div class="text-right">
              <MoneyAmount
                v-if="row.original.status.availablePerDayCents !== null"
                :cents="row.original.status.availablePerDayCents"
                concealable
                data-testid="envelope-per-day"
              />
            </div>
          </template>
          <template #actions-cell="{ row }">
            <div class="flex justify-end">
              <UDropdownMenu :items="actionsOf(row.original)">
                <UButton
                  :icon="icons.rowActions"
                  :aria-label="
                    t('common.actionsFor', {
                      name: row.original.envelope.label,
                    })
                  "
                  color="neutral"
                  variant="ghost"
                />
              </UDropdownMenu>
            </div>
          </template>
          <template #actions-header>
            <span class="sr-only">{{ t('common.actions') }}</span>
          </template>
          <template #body-bottom>
            <tr
              class="border-t border-default text-sm"
              data-testid="envelopes-totals-row"
            >
              <th
                scope="row"
                class="p-4 text-left font-semibold text-highlighted"
              >
                {{ t('envelopes.total') }}
              </th>
              <td class="p-4 text-right">
                <MoneyAmount
                  :cents="result.totals.budgetCents"
                  concealable
                  data-testid="envelopes-total-budget"
                />
              </td>
              <td class="p-4 text-right">
                <MoneyAmount
                  :cents="result.totals.carriedOverCents"
                  concealable
                  variant="flow"
                  data-testid="envelopes-total-carried-over"
                />
              </td>
              <td
                class="p-4 tabular-nums text-default"
                data-testid="envelopes-total-consumed"
              >
                <ConcealedText
                  :text="money(result.totals.consumedCents)"
                  :spoken-text="spokenMoney(result.totals.consumedCents)"
                />
              </td>
              <td class="p-4 text-right">
                <MoneyAmount
                  :cents="result.totals.availableCents"
                  concealable
                  data-testid="envelopes-total-available"
                />
              </td>
              <td v-if="isCurrentMonth" />
              <td />
            </tr>
          </template>
        </UTable>
        <template v-else>
          <ul class="flex flex-col divide-y divide-default">
            <EnvelopeRow
              v-for="line in result.lines"
              :key="line.envelope.id"
              :line="line"
              :current-month="isCurrentMonth"
              @month-amount="openMonthAmount"
              @edit="openForm"
              @delete="envelopeToDelete = $event"
            />
          </ul>
          <div
            class="mt-2 flex flex-col gap-2 border-t border-default pt-3 text-sm"
            data-testid="envelopes-totals"
          >
            <p class="font-semibold text-highlighted">
              {{ t('envelopes.total') }}
            </p>
            <dl class="grid grid-cols-2 gap-2">
              <div>
                <dt class="text-xs font-medium text-muted">
                  {{ t('envelopes.budget') }}
                </dt>
                <dd>
                  <MoneyAmount
                    :cents="result.totals.budgetCents"
                    concealable
                    data-testid="envelopes-total-budget"
                  />
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted">
                  {{ t('envelopes.carriedOver') }}
                </dt>
                <dd>
                  <MoneyAmount
                    :cents="result.totals.carriedOverCents"
                    concealable
                    variant="flow"
                    data-testid="envelopes-total-carried-over"
                  />
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted">
                  {{ t('envelopes.consumed') }}
                </dt>
                <dd
                  class="tabular-nums text-default"
                  data-testid="envelopes-total-consumed"
                >
                  <ConcealedText
                    :text="money(result.totals.consumedCents)"
                    :spoken-text="spokenMoney(result.totals.consumedCents)"
                  />
                </dd>
              </div>
              <div>
                <dt class="text-xs font-medium text-muted">
                  {{ t('envelopes.available') }}
                </dt>
                <dd>
                  <MoneyAmount
                    :cents="result.totals.availableCents"
                    concealable
                    data-testid="envelopes-total-available"
                  />
                </dd>
              </div>
            </dl>
          </div>
        </template>
      </UCard>

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

    <EnvelopeMonthAmountModal
      v-if="month !== null"
      v-model:open="monthAmountOpen"
      :line="monthAmountLine"
      :month="month"
      @saved="monthAmountSaved"
    />

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
