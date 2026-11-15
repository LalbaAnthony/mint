<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import { addMonthsToMonth, monthStart } from '@mint/shared/engines/dates'
import { calendarMonthResponseSchema } from '@mint/shared/schemas/forecast'
import {
  scheduleListResponseSchema,
  scheduleOccurrenceSchema,
} from '@mint/shared/schemas/schedules'
import type { CalendarMonthResponse } from '@mint/shared/types/forecast'
import type { Schedule, ScheduleOccurrence } from '@mint/shared/types/schedules'
import type { CalendarOccurrenceAction } from '~~/types/forecast'

const { t, locale } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const referentials = useReferentialsStore()
const view = useForecastViewStore()
const editor = useOperationEditorStore()
const isWide = useMediaQuery('(min-width: 768px)')
const route = useRoute()
const router = useRouter()

const currentMonth = monthStart(parisDate(new Date()))
const month = ref(currentMonth)
const result = ref<CalendarMonthResponse | null>(null)
const selectedDate = ref<string | null>(null)
const ready = ref(false)

function applyDeepLink(): boolean {
  const link = calendarDeepLink(route.query)
  if (link === null) {
    return false
  }
  if (link.accountId !== null) {
    view.calendarAccountId = link.accountId
  }
  month.value = monthStart(link.day)
  selectedDate.value = link.day
  return true
}

async function clearDeepLink(): Promise<void> {
  if (applyDeepLink()) {
    await router.replace({ query: {} })
  }
}

const openedFromLink = applyDeepLink()

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

function isOutOfRange(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    error.status === 400 &&
    error.issues.some((issue) => issue.message === 'month_out_of_range')
  )
}

function isUnusableAccount(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.status === 404 || error.status === 409) &&
    view.calendarAccountId !== null
  )
}

function defaultSelection(response: CalendarMonthResponse): string {
  const today = response.days.find((day) => day.period === 'today')
  return today?.date ?? response.month
}

async function loadMonth(): Promise<void> {
  if (referentials.activeAccounts.length === 0) {
    result.value = null
    return
  }
  try {
    const response = await apiGet(
      `/calendar/${month.value}?${view.scopeQuery(view.calendarAccountId)}`,
      calendarMonthResponseSchema,
    )
    result.value = response
    if (
      selectedDate.value === null ||
      !response.days.some((day) => day.date === selectedDate.value)
    ) {
      selectedDate.value = defaultSelection(response)
    }
  } catch (error) {
    if (isOutOfRange(error) && month.value !== currentMonth) {
      month.value = currentMonth
      return
    }
    if (isUnusableAccount(error)) {
      view.calendarAccountId = null
      return
    }
    notifyFailure(error)
  }
}

async function load(): Promise<void> {
  try {
    await referentials.load()
  } catch (error) {
    notifyFailure(error)
  }
  await loadMonth()
  ready.value = true
}

onMounted(async () => {
  await load()
  if (openedFromLink) {
    await router.replace({ query: {} })
  }
})
watch(() => editor.savedVersion, load)
watch(() => route.query, clearDeepLink)
watch(
  () => [month.value, view.calendarAccountId, view.horizonMonths],
  loadMonth,
)

const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month.value}T00:00:00Z`)),
)

const canGoBack = computed(
  () => result.value !== null && month.value > result.value.firstMonth,
)
const canGoForward = computed(
  () => result.value !== null && month.value < result.value.lastMonth,
)

function shift(offset: number): void {
  month.value = addMonthsToMonth(month.value, offset)
  selectedDate.value = null
}

function goToToday(): void {
  selectedDate.value = null
  if (month.value === currentMonth) {
    void loadMonth()
    return
  }
  month.value = currentMonth
}

const cells = computed(() =>
  result.value === null ? [] : calendarCells(month.value, result.value.days),
)

const selectedDay = computed(
  () =>
    result.value?.days.find((day) => day.date === selectedDate.value) ?? null,
)

const schedules = ref<Schedule[]>([])

async function loadSchedules(): Promise<void> {
  schedules.value = (
    await apiGet('/schedules', scheduleListResponseSchema)
  ).schedules
}

const occurrenceFormOpen = ref(false)
const editedScheduleId = ref('')
const editedOccurrence = ref<ScheduleOccurrence | null>(null)
const detailScheduleId = ref<string | null>(null)
const detailSchedule = computed(
  () =>
    schedules.value.find(
      (schedule) => schedule.id === detailScheduleId.value,
    ) ?? null,
)
const scheduleDetailOpen = computed({
  get: () => detailSchedule.value !== null,
  set: (open) => {
    if (!open) {
      detailScheduleId.value = null
    }
  },
})
const scheduleFormOpen = ref(false)
const editedSchedule = ref<Schedule | null>(null)

function occurrencePath(action: CalendarOccurrenceAction): string {
  return `/schedules/${action.occurrence.scheduleId}/occurrences/${action.occurrence.occurrence.originalDate}`
}

async function onOccurrenceAction(
  action: CalendarOccurrenceAction,
): Promise<void> {
  try {
    switch (action.kind) {
      case 'edit':
        editedScheduleId.value = action.occurrence.scheduleId
        editedOccurrence.value = action.occurrence.occurrence
        occurrenceFormOpen.value = true
        return
      case 'skip':
        await apiCall(
          'POST',
          `${occurrencePath(action)}/skip`,
          scheduleOccurrenceSchema,
        )
        toast.add({
          title: t('calendar.skipped', { label: action.occurrence.label }),
          icon: icons.success,
          color: 'success',
        })
        await loadMonth()
        return
      case 'restore':
        await apiCall(
          'DELETE',
          occurrencePath(action),
          scheduleOccurrenceSchema,
        )
        await loadMonth()
        return
      case 'openSchedule':
        await loadSchedules()
        detailScheduleId.value = action.occurrence.scheduleId
        return
    }
  } catch (error) {
    notifyFailure(error)
  }
}

function editSchedule(schedule: Schedule): void {
  detailScheduleId.value = null
  editedSchedule.value = schedule
  scheduleFormOpen.value = true
}

async function scheduleChanged(): Promise<void> {
  try {
    await Promise.all([loadSchedules(), loadMonth()])
  } catch (error) {
    notifyFailure(error)
  }
}
</script>

<template>
  <ViewPanel :title="t('navigation.calendar')">
    <div v-if="ready" class="flex flex-col gap-4">
      <UCard v-if="referentials.activeAccounts.length === 0">
        <EmptyState
          :icon="icons.calendar"
          :title="t('forecast.noAccountTitle')"
          :description="t('forecast.noAccountText')"
        >
          <UButton
            :label="t('forecast.goToAccounts')"
            :icon="icons.accounts"
            to="/accounts"
            color="primary"
            variant="soft"
          />
        </EmptyState>
      </UCard>
      <template v-else>
        <UCard>
          <ForecastScopeControls v-model:account-id="view.calendarAccountId" />
        </UCard>
        <div class="flex flex-col gap-4 xl:flex-row xl:items-start">
          <UCard class="min-w-0 xl:flex-1" :ui="{ body: 'p-0 sm:p-0' }">
            <template #header>
              <div class="flex items-center justify-between gap-2">
                <UButton
                  :icon="icons.previous"
                  :aria-label="t('calendar.previousMonth')"
                  :disabled="!canGoBack"
                  color="neutral"
                  variant="ghost"
                  data-testid="calendar-previous"
                  @click="shift(-1)"
                />
                <div class="flex items-center gap-2">
                  <h2
                    class="text-base font-semibold text-highlighted first-letter:uppercase"
                    data-testid="calendar-month"
                  >
                    {{ monthLabel }}
                  </h2>
                  <UButton
                    :label="t('forecast.today')"
                    color="neutral"
                    variant="outline"
                    size="sm"
                    data-testid="calendar-today"
                    @click="goToToday"
                  />
                </div>
                <UButton
                  :icon="icons.next"
                  :aria-label="t('calendar.nextMonth')"
                  :disabled="!canGoForward"
                  color="neutral"
                  variant="ghost"
                  data-testid="calendar-next"
                  @click="shift(1)"
                />
              </div>
            </template>
            <CalendarGrid
              v-if="result !== null"
              :cells="cells"
              :today="result.today"
              :selected-date="selectedDate"
              :threshold-cents="result.thresholdCents"
              :compact="!isWide"
              @select="(date) => (selectedDate = date)"
              @occurrence-action="onOccurrenceAction"
            />
          </UCard>
          <UCard
            v-if="result !== null && selectedDay !== null"
            class="xl:w-96 xl:shrink-0"
          >
            <CalendarDayDetail
              :day="selectedDay"
              :threshold-cents="result.thresholdCents"
              :aggregate="result.accountId === null"
              @occurrence-action="onOccurrenceAction"
            />
          </UCard>
        </div>
      </template>
    </div>

    <OccurrenceFormModal
      v-model:open="occurrenceFormOpen"
      :schedule-id="editedScheduleId"
      :occurrence="editedOccurrence"
      @saved="loadMonth"
    />
    <ScheduleDetailModal
      v-model:open="scheduleDetailOpen"
      :schedule="detailSchedule"
      @edit="editSchedule"
      @changed="scheduleChanged"
    />
    <ScheduleFormModal
      v-model:open="scheduleFormOpen"
      :schedule="editedSchedule"
      @saved="scheduleChanged"
    />
  </ViewPanel>
</template>
