<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { EnvelopeRowEmits, EnvelopeRowProps } from '~~/types/planning'

const props = defineProps<EnvelopeRowProps>()
const emit = defineEmits<EnvelopeRowEmits>()

const { t } = useI18n()
const labels = usePlanningLabels()
const envelopeActions = useEnvelopeActions()

const actions = computed<DropdownMenuItem[][]>(() =>
  envelopeActions({
    monthAmount: () => emit('monthAmount', props.line),
    edit: () => emit('edit', props.line.envelope),
    delete: () => emit('delete', props.line.envelope),
  }),
)
</script>

<template>
  <li
    class="flex flex-col gap-2 py-3"
    :data-testid="`envelope-${line.envelope.id}`"
  >
    <div class="flex items-start gap-2">
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold text-highlighted">
          {{ line.envelope.label }}
        </p>
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
          class="size-11 justify-center"
        />
      </UDropdownMenu>
    </div>
    <EnvelopeConsumption :status="line.status" />
    <dl class="grid grid-cols-2 gap-2 text-sm">
      <div>
        <dt class="text-xs font-medium text-muted">
          {{ t('envelopes.budget') }}
        </dt>
        <dd>
          <EnvelopeBudget :line="line" />
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
    </dl>
  </li>
</template>
