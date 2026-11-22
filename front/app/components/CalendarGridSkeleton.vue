<script setup lang="ts">
import type { CalendarGridSkeletonProps } from '~~/types/skeleton'

const props = defineProps<CalendarGridSkeletonProps>()

const { locale } = useI18n()
const today = parisDate(new Date())

const weekdays = computed(() => calendarWeekdays(locale.value, props.compact))

const weeks = computed(() => {
  const cells = calendarCells(props.month, [], {
    firstMonth: props.month,
    lastMonth: props.month,
  })
  return skeletonIndexes(cells.length / 7).map((week) =>
    cells.slice(week * 7, week * 7 + 7),
  )
})
</script>

<template>
  <div aria-hidden="true" data-testid="calendar-grid-skeleton">
    <div class="grid grid-cols-7 border-b border-default">
      <span
        v-for="weekday in weekdays"
        :key="weekday.long"
        class="py-1 text-center text-xs font-medium text-muted"
      >
        {{ weekday.short }}
      </span>
    </div>
    <div
      v-for="week in weeks"
      :key="week[0]?.date"
      class="grid grid-cols-7 border-b border-default last:border-b-0"
    >
      <div
        v-for="cell in week"
        :key="cell.date"
        class="relative flex min-w-0 flex-col border-r border-default last:border-r-0"
        :class="
          compact ? 'min-h-14 items-center gap-1 p-1' : 'min-h-28 gap-1 p-1.5'
        "
      >
        <span
          class="flex size-5 shrink-0 items-center justify-center rounded-full text-xs font-medium tabular-nums"
          :class="calendarNumberClasses(cell, today)"
        >
          {{ calendarDayNumber(cell.date) }}
        </span>
        <template v-if="cell.inMonth">
          <SkeletonBlock v-if="compact" shape="round" class="h-1.5 w-4" />
          <template v-else>
            <SkeletonText width="full" class="text-xs" />
            <SkeletonText width="sm" align="end" class="mt-auto text-xs" />
          </template>
        </template>
      </div>
    </div>
  </div>
</template>
