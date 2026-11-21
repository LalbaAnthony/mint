<script setup lang="ts">
import {
  interestRateSchema,
  interestResponseSchema,
} from '@mint/shared/schemas/interest'
import type { InterestRate, InterestSummary } from '@mint/shared/types/interest'
import { interestRateFormSchema } from '~~/schemas/forms'
import type {
  InterestModalEmits,
  InterestModalProps,
} from '~~/types/components'
import type { InterestRateFormState } from '~~/types/forms'

const props = defineProps<InterestModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<InterestModalEmits>()

const { t, locale } = useI18n()
const toast = useToast()
const { validator, errorMessage } = useFormValidation()
const { formatDate } = useFormatters()

const rates = ref<InterestRate[]>([])
const summary = ref<InterestSummary | null>(null)
const busy = ref(false)
const state = reactive<InterestRateFormState>({
  effectiveDate: parisDate(new Date()),
  rate: '',
})

const archived = computed(() => props.account?.archivedAt !== null)

function formatRate(rate: number): string {
  return new Intl.NumberFormat(locale.value, {
    style: 'percent',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate / 100)
}

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function load(): Promise<void> {
  const account = props.account
  if (account === null) {
    rates.value = []
    summary.value = null
    return
  }
  try {
    const response = await apiGet(
      `/accounts/${account.id}/interest`,
      interestResponseSchema,
    )
    rates.value = response.rates
    summary.value = response.summary
  } catch (error) {
    notifyFailure(error)
  }
}

watch(
  [open, () => props.account?.id],
  async ([isOpen]) => {
    if (isOpen) {
      state.effectiveDate = parisDate(new Date())
      state.rate = ''
      await load()
    }
  },
  { immediate: true },
)

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  try {
    await action()
    state.rate = ''
    await load()
    emit('changed')
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

function record(): Promise<void> {
  const account = props.account
  const parsed = interestRateFormSchema.safeParse(state)
  if (account === null || !parsed.success) {
    return Promise.resolve()
  }
  return run(() =>
    apiCall(
      'POST',
      `/accounts/${account.id}/interest-rates`,
      interestRateSchema,
      {
        effectiveDate: parsed.data.effectiveDate,
        annualRatePct: parsed.data.rate,
      },
    ),
  )
}

function remove(rate: InterestRate): Promise<void> {
  return run(() => apiCommand('DELETE', `/interest-rates/${rate.id}`))
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('interest.title', { name: account?.name ?? '' })"
    :description="t('interest.help')"
  >
    <template #body>
      <div class="flex flex-col gap-4" data-testid="interest">
        <dl
          v-if="summary !== null"
          class="grid grid-cols-1 gap-3 sm:grid-cols-3"
          data-testid="interest-summary"
        >
          <div>
            <dt class="text-xs font-medium text-muted">
              {{ t('interest.currentRate') }}
            </dt>
            <dd class="text-sm tabular-nums text-default">
              {{
                summary.annualRatePct === null
                  ? t('interest.noRate')
                  : formatRate(summary.annualRatePct)
              }}
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted">
              {{
                t('interest.acquired', {
                  date: formatDate(summary.periodStart),
                })
              }}
            </dt>
            <dd data-testid="interest-acquired">
              <MoneyAmount
                :cents="summary.acquiredCents"
                variant="flow"
                concealable
              />
            </dd>
          </div>
          <div>
            <dt class="text-xs font-medium text-muted">
              {{
                t('interest.projected', {
                  date: formatDate(summary.nextCapitalizationDate),
                })
              }}
            </dt>
            <dd data-testid="interest-projected">
              <MoneyAmount
                :cents="summary.projectedCents"
                variant="flow"
                concealable
              />
            </dd>
          </div>
        </dl>
        <UForm
          v-if="!archived"
          :state="state"
          :validate="validator(interestRateFormSchema)"
          :validate-on="['blur']"
          class="flex flex-wrap items-end gap-2"
          data-testid="interest-rate-form"
          @submit="record"
        >
          <AppFormField
            :label="t('interest.effectiveDate')"
            name="effectiveDate"
          >
            <UInput v-model="state.effectiveDate" type="date" />
          </AppFormField>
          <AppFormField :label="t('interest.rate')" name="rate">
            <UInput
              v-model="state.rate"
              inputmode="decimal"
              class="text-right tabular-nums"
              data-testid="interest-rate"
            />
          </AppFormField>
          <OfflineGuard v-slot="{ offline }">
            <UButton
              :disabled="offline"
              type="submit"
              :label="t('interest.record')"
              color="primary"
              variant="solid"
              :loading="busy"
              data-testid="interest-rate-submit"
            />
          </OfflineGuard>
        </UForm>
        <p v-if="rates.length === 0" class="text-sm text-muted">
          {{ t('interest.empty') }}
        </p>
        <ul v-else class="flex flex-col divide-y divide-default">
          <li
            v-for="rate in rates"
            :key="rate.id"
            class="flex flex-wrap items-center gap-2 py-2"
            :data-testid="`interest-rate-${rate.effectiveDate}`"
          >
            <span class="text-sm tabular-nums">
              {{ formatDate(rate.effectiveDate) }}
            </span>
            <span class="ml-auto text-sm tabular-nums text-highlighted">
              {{ formatRate(rate.annualRatePct) }}
            </span>
            <OfflineGuard v-if="!archived" v-slot="{ offline }">
              <UButton
                :disabled="offline"
                :icon="icons.delete"
                :aria-label="
                  t('interest.deleteOf', {
                    date: formatDate(rate.effectiveDate),
                  })
                "
                color="error"
                variant="ghost"
                :loading="busy"
                data-testid="interest-rate-delete"
                @click="remove(rate)"
              />
            </OfflineGuard>
          </li>
        </ul>
      </div>
    </template>
  </UModal>
</template>
