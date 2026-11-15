<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { EnvelopeCardEmits, EnvelopeCardProps } from '~~/types/planning'

const props = defineProps<EnvelopeCardProps>()
const emit = defineEmits<EnvelopeCardEmits>()

const { t } = useI18n()
const { formatMoney } = useFormatters()
const labels = usePlanningLabels()

const allowance = computed(
  () => props.line.status.budgetCents + props.line.status.carriedOverCents,
)
const tone = computed(() =>
  envelopeTone(props.line.status.consumedCents, allowance.value),
)
const progress = computed(() =>
  envelopeProgress(props.line.status.consumedCents, allowance.value),
)
const overrun = computed(() =>
  Math.max(0, props.line.status.consumedCents - allowance.value),
)

const actions = computed<DropdownMenuItem[][]>(() => [
  [
    {
      label: t('common.edit'),
      icon: icons.edit,
      onSelect: () => emit('edit', props.line.envelope),
    },
  ],
  [
    {
      label: t('common.delete'),
      icon: icons.delete,
      color: 'error',
      onSelect: () => emit('delete', props.line.envelope),
    },
  ],
])
</script>

<template>
  <UCard :data-testid="`envelope-${line.envelope.id}`">
    <div class="flex flex-col gap-3">
      <div class="flex items-start gap-2">
        <div class="min-w-0 flex-1">
          <h3 class="truncate text-base font-semibold text-highlighted">
            {{ line.envelope.label }}
          </h3>
          <p class="truncate text-xs text-muted">
            {{ labels.envelopeSourceLabel(line.envelope) }}
          </p>
        </div>
        <UDropdownMenu :items="actions">
          <UButton
            :icon="icons.rowActions"
            :aria-label="t('common.actionsFor', { name: line.envelope.label })"
            color="neutral"
            variant="ghost"
          />
        </UDropdownMenu>
      </div>
      <UProgress
        :model-value="progress"
        :color="tone"
        size="md"
        :aria-label="
          t('envelopes.progressLabel', {
            consumed: formatMoney(line.status.consumedCents),
            budget: formatMoney(allowance),
          })
        "
        :data-tone="tone"
        data-testid="envelope-progress"
      />
      <div class="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span class="tabular-nums text-default" data-testid="envelope-consumed">
          {{
            t('envelopes.consumedOfBudget', {
              consumed: formatMoney(line.status.consumedCents),
              budget: formatMoney(allowance),
            })
          }}
        </span>
        <span
          v-if="overrun > 0"
          class="tabular-nums text-error"
          data-testid="envelope-overrun"
        >
          {{ t('envelopes.overrun', { amount: formatMoney(overrun) }) }}
        </span>
      </div>
      <dl class="grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt class="text-xs font-medium text-muted">
            {{ t('envelopes.available') }}
          </dt>
          <dd>
            <MoneyAmount
              :cents="line.status.availableCents"
              data-testid="envelope-available"
            />
          </dd>
        </div>
        <div v-if="currentMonth && line.status.availablePerDayCents !== null">
          <dt class="text-xs font-medium text-muted">
            {{ t('envelopes.perRemainingDay') }}
          </dt>
          <dd>
            <MoneyAmount
              :cents="line.status.availablePerDayCents"
              data-testid="envelope-per-day"
            />
          </dd>
        </div>
        <div v-if="line.status.carriedOverCents !== 0">
          <dt class="text-xs font-medium text-muted">
            {{ t('envelopes.carriedOver') }}
          </dt>
          <dd>
            <MoneyAmount :cents="line.status.carriedOverCents" variant="flow" />
          </dd>
        </div>
      </dl>
    </div>
  </UCard>
</template>
