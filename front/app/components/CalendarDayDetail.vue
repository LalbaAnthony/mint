<script setup lang="ts">
import type { Operation } from '@mint/shared/types/operations'
import type {
  CalendarDayDetailEmits,
  CalendarDayDetailProps,
} from '~~/types/forecast'

const props = defineProps<CalendarDayDetailProps>()
const emit = defineEmits<CalendarDayDetailEmits>()

const { t, locale } = useI18n()
const connectivity = useConnectivityStore()
const { money, spokenMoney } = useAmountMask()
const referentials = useReferentialsStore()
const editor = useOperationEditorStore()

const title = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${props.day.date}T00:00:00Z`)),
)

const balanceLabel = computed(() =>
  props.day.period === 'past'
    ? t('calendar.realBalance')
    : t('calendar.forecastBalance'),
)

const isPlanned = computed(
  () => props.day.period === 'today' || props.day.period === 'future',
)

function detailOf(operation: Operation): string {
  if (operation.transferGroupId !== null) {
    return t('operations.transferWith', {
      account: referentials.accountName(operation.counterpartAccountId),
    })
  }
  return operation.categoryId === null
    ? t('operations.statuses.to_categorize')
    : referentials.categoryName(operation.categoryId)
}

function accountSuffix(accountId: string): string {
  return props.aggregate ? ` · ${referentials.accountName(accountId)}` : ''
}
</script>

<template>
  <section class="flex flex-col gap-4" data-testid="calendar-day-detail">
    <header class="flex flex-wrap items-baseline justify-between gap-2">
      <h2
        class="text-base font-semibold text-highlighted first-letter:uppercase"
      >
        {{ title }}
      </h2>
      <p
        v-if="day.balanceCents !== null && day.period !== 'beyond'"
        class="flex items-center gap-1 text-sm text-muted"
      >
        {{ balanceLabel }}
        <MoneyAmount
          :cents="day.balanceCents"
          :threshold="thresholdCents"
          concealable
          class="font-semibold"
          data-testid="calendar-detail-balance"
        />
      </p>
    </header>

    <p v-if="day.period === 'beyond'" class="text-sm text-muted">
      {{ t('calendar.beyondHorizon') }}
    </p>
    <p v-else-if="day.balanceCents === null" class="text-sm text-muted">
      {{ t('calendar.beforeHistory') }}
    </p>

    <div
      v-if="isPlanned && day.occurrences.length > 0"
      class="flex flex-col gap-1"
    >
      <h3 class="text-sm font-medium text-muted">
        {{ t('calendar.occurrences') }}
      </h3>
      <ul class="flex flex-col divide-y divide-default">
        <li
          v-for="item in day.occurrences"
          :key="`${item.scheduleId}-${item.occurrence.originalDate}-${item.accountId}`"
        >
          <CalendarOccurrenceMenu
            :occurrence="item"
            @action="(action) => emit('occurrenceAction', action)"
          >
            <button
              type="button"
              class="flex w-full items-center gap-2 py-2 text-left"
              :data-testid="`detail-occurrence-${item.scheduleId}`"
            >
              <UIcon
                :name="icons[item.kind]"
                class="size-4 shrink-0 text-muted"
              />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2 text-sm text-default">
                  <span class="truncate">{{ item.label }}</span>
                  <PlanningMarker
                    v-if="item.triggerMode === 'manual'"
                    kind="manual"
                  />
                  <PlanningMarker
                    v-if="item.isSubscription"
                    kind="subscription"
                  />
                  <UBadge
                    v-if="item.occurrence.overridden"
                    :label="t('schedules.occurrences.overridden')"
                    color="neutral"
                    variant="soft"
                  />
                  <CapExcessBadge
                    v-if="item.capExcessCents !== null"
                    :excess-cents="item.capExcessCents"
                  />
                </span>
                <span
                  v-if="aggregate"
                  class="block truncate text-xs text-muted"
                >
                  {{ referentials.accountName(item.accountId) }}
                </span>
              </span>
              <MoneyAmount
                :cents="item.amountCents"
                variant="flow"
                class="text-sm"
              />
            </button>
          </CalendarOccurrenceMenu>
        </li>
      </ul>
    </div>

    <div v-if="day.operations.length > 0" class="flex flex-col gap-1">
      <h3
        class="flex items-center justify-between text-sm font-medium text-muted"
      >
        <span>
          {{
            day.period === 'future'
              ? t('calendar.plannedOperations')
              : t('calendar.operationCount', day.operations.length)
          }}
        </span>
        <span
          v-if="day.period !== 'future'"
          class="tabular-nums"
          data-testid="calendar-detail-total"
        >
          <ConcealedText
            :text="money(operationsTotalCents(day), 'exceptZero')"
            :spoken-text="spokenMoney(operationsTotalCents(day), 'exceptZero')"
          />
        </span>
      </h3>
      <ul class="flex flex-col divide-y divide-default">
        <li v-for="operation in day.operations" :key="operation.id">
          <button
            type="button"
            class="flex w-full items-center gap-2 py-2 text-left"
            :disabled="connectivity.offline"
            :title="
              connectivity.offline ? t('offline.writeDisabled') : undefined
            "
            :data-testid="`detail-operation-${operation.id}`"
            @click="editor.edit(operation)"
          >
            <UIcon
              :name="originIcon(operation)"
              class="size-4 shrink-0 text-muted"
              :aria-label="t(`operations.origins.${operation.origin}`)"
            />
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm text-default">
                {{ operation.label }}
              </span>
              <span class="block truncate text-xs text-muted">
                {{ detailOf(operation)
                }}{{ accountSuffix(operation.accountId) }}
              </span>
            </span>
            <MoneyAmount
              :cents="operation.amountCents"
              variant="flow"
              class="text-sm"
            />
          </button>
        </li>
      </ul>
    </div>

    <div
      v-if="isPlanned && day.envelopeShares.length > 0"
      class="flex flex-col gap-1"
    >
      <h3 class="text-sm font-medium text-muted">
        {{ t('calendar.envelopeShares') }}
      </h3>
      <ul class="flex flex-col divide-y divide-default">
        <li
          v-for="share in day.envelopeShares"
          :key="share.envelopeId"
          class="flex items-center gap-2 py-2"
        >
          <UIcon :name="icons.envelopes" class="size-4 shrink-0 text-muted" />
          <span class="min-w-0 flex-1 truncate text-sm text-default">
            {{ share.label }}{{ accountSuffix(share.accountId) }}
          </span>
          <MoneyAmount
            :cents="share.amountCents"
            variant="flow"
            class="text-sm"
          />
        </li>
      </ul>
    </div>

    <p
      v-if="
        day.period !== 'beyond' &&
        day.balanceCents !== null &&
        day.operations.length === 0 &&
        (!isPlanned ||
          (day.occurrences.length === 0 && day.envelopeShares.length === 0))
      "
      class="text-sm text-muted"
    >
      {{ t('calendar.nothing') }}
    </p>
  </section>
</template>
