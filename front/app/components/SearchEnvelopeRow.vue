<script setup lang="ts">
import type { SearchEnvelopeRowProps } from '~~/types/search'

const props = defineProps<SearchEnvelopeRowProps>()

const { t } = useI18n()
const results = useSearchResults()
</script>

<template>
  <li>
    <button
      type="button"
      class="flex w-full items-start gap-3 px-4 py-2 text-left hover:bg-muted sm:px-6"
      :data-testid="`search-envelope-${result.envelope.id}`"
      @click="results.open({ kind: 'envelope', envelope: props.result })"
    >
      <UIcon
        :name="icons.envelopes"
        class="mt-0.5 size-4 shrink-0 text-muted"
      />
      <div class="flex min-w-0 flex-1 flex-col gap-2">
        <div class="flex items-start gap-3">
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-2 text-sm text-default">
              <span class="truncate">{{ result.envelope.label }}</span>
              <UBadge
                v-if="result.status === null"
                :label="t('schedules.inactive')"
                color="neutral"
                variant="soft"
                size="sm"
              />
            </p>
            <p class="truncate text-xs text-muted">
              {{ results.envelopeDetail(result.envelope) }}
            </p>
          </div>
          <div class="flex flex-col items-end">
            <MoneyAmount
              :cents="
                result.status === null
                  ? result.envelope.monthlyAmountCents
                  : result.status.availableCents
              "
              concealable
              class="text-sm font-semibold"
            />
            <span class="text-xs text-muted">
              {{
                result.status === null
                  ? t('envelopes.fields.amount')
                  : t('envelopes.available')
              }}
            </span>
          </div>
        </div>
        <EnvelopeConsumption
          v-if="result.status !== null"
          :status="result.status"
        />
      </div>
    </button>
  </li>
</template>
