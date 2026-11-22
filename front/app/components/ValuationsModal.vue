<script setup lang="ts">
import { valuationChart } from '~/charts/lazy'
import {
  valuationListResponseSchema,
  valuationSchema,
} from '@mint/shared/schemas/valuations'
import type {
  InvestmentSummary,
  Valuation,
} from '@mint/shared/types/valuations'
import { valuationFormSchema } from '~~/schemas/forms'
import type {
  ValuationFormState,
  ValuationsModalEmits,
  ValuationsModalProps,
} from '~~/types/valuations'

const props = defineProps<ValuationsModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<ValuationsModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const { formatDate } = useFormatters()

const valuations = ref<Valuation[]>([])
const summary = ref<InvestmentSummary | null>(null)
const edited = ref<Valuation | null>(null)
const busy = ref(false)
const state = reactive<ValuationFormState>({
  date: parisDate(new Date()),
  value: '',
})

const archived = computed(() => props.account?.archivedAt !== null)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

function resetForm(): void {
  edited.value = null
  state.date = parisDate(new Date())
  state.value = ''
}

const ValuationsChart = valuationChart.component

const loadState = useLoadState({ onError: notifyFailure })

async function fetchValuations(): Promise<void> {
  const account = props.account
  if (account === null) {
    valuations.value = []
    summary.value = null
    return
  }
  const [response] = await Promise.all([
    apiGet(`/accounts/${account.id}/valuations`, valuationListResponseSchema),
    valuationChart.load(),
  ])
  valuations.value = response.valuations
  summary.value = response.summary
}

function load(): Promise<void> {
  return loadState.run(fetchValuations, 'background')
}

watch(
  [open, () => props.account?.id],
  async ([isOpen]) => {
    if (isOpen) {
      resetForm()
      await loadState.run(fetchValuations)
    }
  },
  { immediate: true },
)

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  try {
    await action()
    resetForm()
    await load()
    emit('changed')
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

function startEdit(valuation: Valuation): void {
  edited.value = valuation
  state.date = valuation.date
  state.value = formatAmountInput(valuation.valueCents, locale.value)
}

const schema = computed(() => valuationFormSchema(locale.value))

function record(): Promise<void> {
  const account = props.account
  const value = parseAmountInput(state.value, locale.value)
  if (
    account === null ||
    value === null ||
    !schema.value.safeParse(state).success
  ) {
    return Promise.resolve()
  }
  const body = { date: state.date, valueCents: value }
  const current = edited.value
  return run(() =>
    current === null
      ? apiCall(
          'POST',
          `/accounts/${account.id}/valuations`,
          valuationSchema,
          body,
        )
      : apiCall('PATCH', `/valuations/${current.id}`, valuationSchema, body),
  )
}

function remove(valuation: Valuation): Promise<void> {
  return run(() => apiCommand('DELETE', `/valuations/${valuation.id}`))
}

const skeletonRows = useRememberedCount(
  'valuations',
  loadState,
  () => valuations.value.length,
)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('valuations.title', { name: account?.name ?? '' })"
    :description="t('valuations.help')"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="valuations">
        <LoadZone :state="loadState" :error-state="false">
          <template #skeleton>
            <dl class="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div v-for="index in skeletonIndexes()" :key="index">
                <dt><SkeletonText width="md" class="text-xs" /></dt>
                <dd><SkeletonAmount concealable /></dd>
              </div>
            </dl>
          </template>
          <dl
            v-if="summary !== null"
            class="grid grid-cols-1 gap-3 sm:grid-cols-3"
            data-testid="valuation-summary"
          >
            <div>
              <dt class="text-xs font-medium text-muted">
                {{ t('valuations.paidIn') }}
              </dt>
              <dd data-testid="valuation-paid-in">
                <MoneyAmount :cents="summary.paidInCents" concealable />
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted">
                {{ t('valuations.lastValuation') }}
              </dt>
              <dd v-if="summary.lastValuation !== null">
                <MoneyAmount
                  :cents="summary.lastValuation.valueCents"
                  concealable
                />
                <span class="block text-xs text-muted tabular-nums">
                  {{ formatDate(summary.lastValuation.date) }}
                </span>
              </dd>
              <dd v-else class="text-sm text-muted">
                {{ t('valuations.none') }}
              </dd>
            </div>
            <div>
              <dt class="text-xs font-medium text-muted">
                {{ t('valuations.gain') }}
              </dt>
              <dd>
                <InvestmentGain
                  v-if="summary.latentGainCents !== null"
                  :summary="summary"
                  concealable
                />
                <span v-else class="text-sm text-muted">-</span>
              </dd>
            </div>
          </dl>
        </LoadZone>
        <LoadZone :state="loadState" :error-state="false">
          <template #skeleton>
            <ValuationChartSkeleton />
          </template>
          <ValuationsChart
            v-if="valuations.length > 0"
            :valuations="valuations"
          />
        </LoadZone>
        <AppForm
          v-if="!archived"
          :state="state"
          :validate="validator(schema)"
          :validate-on="['blur']"
          class="flex flex-wrap items-end gap-2"
          data-testid="valuation-form"
          @submit="record"
        >
          <AppFormField :label="t('valuations.date')" name="date">
            <UInput v-model="state.date" type="date" />
          </AppFormField>
          <AppFormField :label="t('valuations.value')" name="value">
            <AmountInput v-model="state.value" data-testid="valuation-value" />
          </AppFormField>
          <OfflineGuard v-slot="{ offline }">
            <ShortcutTooltip shortcut="submit">
              <UButton
                :disabled="offline"
                type="submit"
                :label="
                  edited === null ? t('valuations.record') : t('common.save')
                "
                color="primary"
                variant="solid"
                :loading="busy"
                data-testid="valuation-submit"
              />
            </ShortcutTooltip>
          </OfflineGuard>
          <UButton
            v-if="edited !== null"
            :label="t('common.cancel')"
            color="neutral"
            variant="ghost"
            @click="resetForm"
          />
        </AppForm>
        <LoadZone :state="loadState">
          <template #skeleton>
            <SkeletonDetailList
              :count="skeletonRows"
              actions="button"
              :row="{ wrap: true }"
              class="flex flex-col divide-y divide-default"
            />
          </template>
          <p v-if="valuations.length === 0" class="text-sm text-muted">
            {{ t('valuations.empty') }}
          </p>
          <ul v-else class="flex flex-col divide-y divide-default">
            <ListRow
              v-for="valuation in valuations"
              :key="valuation.id"
              wrap
              :data-testid="`valuation-${valuation.date}`"
            >
              <span class="text-sm tabular-nums">
                {{ formatDate(valuation.date) }}
              </span>
              <MoneyAmount :cents="valuation.valueCents" class="ml-auto" />
              <template v-if="!archived">
                <OfflineGuard v-slot="{ offline }">
                  <UButton
                    :disabled="offline"
                    :icon="icons.edit"
                    :aria-label="
                      t('valuations.editOf', {
                        date: formatDate(valuation.date),
                      })
                    "
                    color="neutral"
                    variant="ghost"
                    @click="startEdit(valuation)"
                  />
                </OfflineGuard>
                <OfflineGuard v-slot="{ offline }">
                  <UButton
                    :disabled="offline"
                    :icon="icons.delete"
                    :aria-label="
                      t('valuations.deleteOf', {
                        date: formatDate(valuation.date),
                      })
                    "
                    color="error"
                    variant="ghost"
                    :loading="busy"
                    data-testid="valuation-delete"
                    @click="remove(valuation)"
                  />
                </OfflineGuard>
              </template>
            </ListRow>
          </ul>
        </LoadZone>
      </div>
    </template>
  </UModal>
</template>
