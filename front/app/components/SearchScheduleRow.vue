<script setup lang="ts">
import type { SearchScheduleRowProps } from '~~/types/search'

const props = defineProps<SearchScheduleRowProps>()

const { t } = useI18n()
const { formatMoney } = useFormatters()
const results = useSearchResults()

const badge = computed(() => results.scheduleBadge(props.schedule))
</script>

<template>
  <li>
    <button
      type="button"
      class="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-muted sm:px-6"
      :data-testid="`search-schedule-${schedule.id}`"
      @click="results.open({ kind: 'schedule', schedule: props.schedule })"
    >
      <UIcon :name="icons[schedule.kind]" class="size-4 shrink-0 text-muted" />
      <div class="min-w-0 flex-1">
        <p class="flex items-center gap-2 text-sm text-default">
          <span class="truncate">{{ schedule.label }}</span>
          <PlanningMarker
            v-if="schedule.triggerMode === 'manual'"
            kind="manual"
          />
          <PlanningMarker v-if="schedule.isSubscription" kind="subscription" />
          <UBadge
            v-if="badge !== null"
            :label="badge"
            color="neutral"
            variant="soft"
            size="sm"
          />
        </p>
        <p class="truncate text-xs text-muted">
          {{ results.scheduleDetail(schedule) }}
        </p>
      </div>
      <div class="flex flex-col items-end">
        <MoneyAmount
          :cents="results.scheduleCents(schedule)"
          variant="flow"
          class="text-sm font-medium"
        />
        <span
          v-if="schedule.monthlyEquivalentCents !== null"
          class="text-xs text-muted tabular-nums"
        >
          {{
            t('search.perMonth', {
              amount: formatMoney(schedule.monthlyEquivalentCents, 'auto'),
            })
          }}
        </span>
      </div>
    </button>
  </li>
</template>
