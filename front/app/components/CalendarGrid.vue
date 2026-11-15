<script setup lang="ts">
import type { CalendarDay } from '@mint/shared/types/forecast'
import type {
  CalendarAlert,
  CalendarCell,
  CalendarDotKind,
  CalendarGridEmits,
  CalendarGridProps,
} from '~~/types/forecast'

const props = defineProps<CalendarGridProps>()
const emit = defineEmits<CalendarGridEmits>()

const { t, locale } = useI18n()
const { formatMoney } = useFormatters()

const firstMonday = '2026-11-16'

const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${firstMonday}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + index)
    return {
      short: new Intl.DateTimeFormat(locale.value, {
        weekday: props.compact ? 'narrow' : 'short',
        timeZone: 'UTC',
      }).format(date),
      long: new Intl.DateTimeFormat(locale.value, {
        weekday: 'long',
        timeZone: 'UTC',
      }).format(date),
    }
  }),
)

const weeks = computed(() => {
  const rows: CalendarCell[][] = []
  for (let index = 0; index < props.cells.length; index += 7) {
    rows.push(props.cells.slice(index, index + 7))
  }
  return rows
})

const alertClasses = {
  none: '',
  belowThreshold: 'bg-warning/10',
  negative: 'bg-error/10',
} as const satisfies Record<CalendarAlert, string>

const dotClasses = {
  credit: 'bg-success',
  debit: 'bg-inverted',
  manual: 'bg-accent-fill',
} as const satisfies Record<CalendarDotKind, string>

function alertOf(cell: CalendarCell): CalendarAlert {
  return hasCalendarContent(cell.day)
    ? calendarAlert(cell.day?.balanceCents ?? null, props.thresholdCents)
    : 'none'
}

function dayNumber(date: string): number {
  return Number(date.slice(8, 10))
}

function cellLabel(cell: CalendarCell): string {
  const date = new Intl.DateTimeFormat(locale.value, {
    dateStyle: 'full',
    timeZone: 'UTC',
  }).format(new Date(`${cell.date}T00:00:00Z`))
  const balance = cell.day?.balanceCents
  if (
    !hasCalendarContent(cell.day) ||
    balance === undefined ||
    balance === null
  ) {
    return date
  }
  return t('calendar.cellLabel', { date, balance: formatMoney(balance) })
}

function visibleOccurrences(day: CalendarDay) {
  return day.occurrences.slice(0, calendarOccurrencesPerCell)
}

function hiddenCount(day: CalendarDay): number {
  return Math.max(0, day.occurrences.length - calendarOccurrencesPerCell)
}

function numberClasses(cell: CalendarCell): string {
  if (cell.date === props.today && cell.inMonth) {
    return 'bg-primary text-inverted'
  }
  return !cell.inMonth || cell.nonWorking ? 'text-dimmed' : 'text-default'
}
</script>

<template>
  <div
    role="grid"
    :aria-label="t('calendar.gridLabel')"
    data-testid="calendar-grid"
  >
    <div role="row" class="grid grid-cols-7 border-b border-default">
      <span
        v-for="weekday in weekdays"
        :key="weekday.long"
        role="columnheader"
        :aria-label="weekday.long"
        class="py-1 text-center text-xs font-medium text-muted"
      >
        {{ weekday.short }}
      </span>
    </div>
    <div
      v-for="week in weeks"
      :key="week[0]?.date"
      role="row"
      class="grid grid-cols-7 border-b border-default last:border-b-0"
    >
      <div
        v-for="cell in week"
        :key="cell.date"
        role="gridcell"
        class="relative flex min-w-0 flex-col border-r border-default last:border-r-0"
        :class="[
          alertClasses[alertOf(cell)],
          compact ? 'min-h-14 items-center gap-1 p-1' : 'min-h-28 gap-1 p-1.5',
          cell.date === selectedDate ? 'ring-2 ring-primary ring-inset' : '',
        ]"
        :aria-selected="cell.date === selectedDate"
        :data-testid="`calendar-day-${cell.date}`"
        :data-alert="alertOf(cell)"
      >
        <button
          v-if="cell.inMonth"
          type="button"
          class="absolute inset-0 focus-visible:outline-2 focus-visible:outline-primary"
          :aria-label="cellLabel(cell)"
          :aria-pressed="cell.date === selectedDate"
          :data-testid="`calendar-select-${cell.date}`"
          @click="emit('select', cell.date)"
        />
        <span
          class="pointer-events-none flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums"
          :class="numberClasses(cell)"
          aria-hidden="true"
        >
          {{ dayNumber(cell.date) }}
        </span>
        <template v-if="cell.day !== null && hasCalendarContent(cell.day)">
          <template v-if="compact">
            <span class="pointer-events-none flex gap-0.5" aria-hidden="true">
              <span
                v-for="dot in calendarDots(cell.day)"
                :key="dot"
                class="size-1.5 rounded-full"
                :class="dotClasses[dot]"
                :data-dot="dot"
              />
            </span>
          </template>
          <template v-else>
            <ul
              v-if="cell.day.occurrences.length > 0"
              class="relative z-10 flex min-w-0 flex-col gap-0.5"
            >
              <li
                v-for="item in visibleOccurrences(cell.day)"
                :key="`${item.scheduleId}-${item.occurrence.originalDate}-${item.accountId}`"
              >
                <CalendarOccurrenceMenu
                  :occurrence="item"
                  @action="(action) => emit('occurrenceAction', action)"
                >
                  <button
                    type="button"
                    class="flex w-full min-w-0 items-center gap-1 rounded-sm text-left text-xs hover:bg-muted"
                    :data-testid="`calendar-occurrence-${item.scheduleId}-${item.occurrence.originalDate}`"
                  >
                    <span class="min-w-0 flex-1 truncate text-default">
                      {{ item.label }}
                    </span>
                    <PlanningMarker
                      v-if="item.triggerMode === 'manual'"
                      kind="manual"
                    />
                    <PlanningMarker
                      v-if="item.isSubscription"
                      kind="subscription"
                    />
                    <UIcon
                      v-if="item.capExcessCents !== null"
                      :name="icons.belowThreshold"
                      class="size-4 shrink-0 text-warning"
                      :aria-label="t('caps.exceededShort')"
                      data-testid="calendar-cap-excess"
                    />
                    <MoneyAmount :cents="item.amountCents" variant="flow" />
                  </button>
                </CalendarOccurrenceMenu>
              </li>
              <li
                v-if="hiddenCount(cell.day) > 0"
                class="pointer-events-none text-xs text-muted"
              >
                {{ t('calendar.more', hiddenCount(cell.day)) }}
              </li>
            </ul>
            <p
              v-if="
                cell.day.period !== 'future' && cell.day.operations.length > 0
              "
              class="pointer-events-none flex flex-wrap items-center gap-1 text-xs text-muted"
              data-testid="calendar-operations-summary"
            >
              <span>
                {{ t('calendar.operationCount', cell.day.operations.length) }}
              </span>
              <span class="tabular-nums">
                {{ formatMoney(operationsTotalCents(cell.day), 'exceptZero') }}
              </span>
            </p>
            <MoneyAmount
              v-if="cell.day.balanceCents !== null"
              :cents="cell.day.balanceCents"
              :threshold="thresholdCents"
              class="pointer-events-none mt-auto self-end text-xs font-semibold"
              data-testid="calendar-balance"
            />
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
