<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import {
  scheduleOccurrenceListResponseSchema,
  scheduleOccurrenceSchema,
  updateScheduleResponseSchema,
} from '@mint/shared/schemas/schedules'
import type { ScheduleOccurrence } from '@mint/shared/types/schedules'
import type {
  ScheduleDetailModalEmits,
  ScheduleDetailModalProps,
} from '~~/types/planning'

const props = defineProps<ScheduleDetailModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<ScheduleDetailModalEmits>()

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()
const labels = usePlanningLabels()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const occurrences = ref<ScheduleOccurrence[]>([])
const busy = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function loadOccurrences(): Promise<void> {
  const schedule = props.schedule
  if (schedule === null) {
    occurrences.value = []
    return
  }
  try {
    occurrences.value = (
      await apiGet(
        `/schedules/${schedule.id}/occurrences`,
        scheduleOccurrenceListResponseSchema,
      )
    ).occurrences
  } catch (error) {
    notifyFailure(error)
  }
}

watch(
  [open, () => props.schedule?.id],
  async ([isOpen]) => {
    if (isOpen) {
      await loadOccurrences()
    }
  },
  { immediate: true },
)

function signed(cents: number): number {
  return props.schedule?.kind === 'expense' ? -cents : cents
}

async function run(action: () => Promise<unknown>): Promise<void> {
  busy.value = true
  try {
    await action()
    emit('changed')
    await loadOccurrences()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

function occurrencePath(occurrence: ScheduleOccurrence): string {
  return `/schedules/${props.schedule?.id ?? ''}/occurrences/${occurrence.originalDate}`
}

function skip(occurrence: ScheduleOccurrence): Promise<void> {
  return run(() =>
    apiCall(
      'POST',
      `${occurrencePath(occurrence)}/skip`,
      scheduleOccurrenceSchema,
    ),
  )
}

function restore(occurrence: ScheduleOccurrence): Promise<void> {
  return run(() =>
    apiCall('DELETE', occurrencePath(occurrence), scheduleOccurrenceSchema),
  )
}

function toggleActive(): Promise<void> {
  const schedule = props.schedule
  if (schedule === null) {
    return Promise.resolve()
  }
  return run(() =>
    apiCall(
      'PATCH',
      `/schedules/${schedule.id}`,
      updateScheduleResponseSchema,
      { active: !schedule.active },
    ),
  )
}

const occurrenceFormOpen = ref(false)
const editedOccurrence = ref<ScheduleOccurrence | null>(null)

function editOccurrence(occurrence: ScheduleOccurrence): void {
  editedOccurrence.value = occurrence
  occurrenceFormOpen.value = true
}

async function occurrenceSaved(): Promise<void> {
  emit('changed')
  await loadOccurrences()
}

const deleteOpen = ref(false)

async function deleteSchedule(): Promise<void> {
  const schedule = props.schedule
  if (schedule === null) {
    return
  }
  busy.value = true
  try {
    await apiCommand('DELETE', `/schedules/${schedule.id}`)
    deleteOpen.value = false
    open.value = false
    toast.add({
      title: t('schedules.deleted', { label: schedule.label }),
      icon: icons.success,
      color: 'success',
    })
    emit('changed')
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="schedule?.label ?? ''"
    :fullscreen="!isDesktop"
  >
    <template #body>
      <div
        v-if="schedule !== null"
        class="flex flex-col gap-6"
        data-testid="schedule-detail"
      >
        <p
          v-if="schedule.capExcess !== null"
          class="flex flex-wrap items-center gap-2 text-sm text-default"
          data-testid="schedule-cap-excess"
        >
          {{
            t('caps.nextOccurrence', {
              date: formatDate(schedule.capExcess.effectiveDate),
            })
          }}
          <CapExcessBadge :excess-cents="schedule.capExcess.excessCents" />
        </p>
        <dl class="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt class="font-medium text-muted">
              {{ t('schedules.fields.kind') }}
            </dt>
            <dd class="flex items-center gap-2">
              {{ labels.kindLabel(schedule.kind) }}
              <PlanningMarker
                v-if="schedule.triggerMode === 'manual'"
                kind="manual"
              />
              <PlanningMarker
                v-if="schedule.isSubscription"
                kind="subscription"
              />
            </dd>
          </div>
          <div>
            <dt class="font-medium text-muted">
              {{ t('schedules.fields.amount') }}
            </dt>
            <dd>
              <MoneyAmount
                :cents="signed(schedule.amountCents)"
                variant="flow"
              />
            </dd>
          </div>
          <div>
            <dt class="font-medium text-muted">
              {{ t('schedules.fields.recurrence') }}
            </dt>
            <dd>{{ labels.recurrenceLabel(schedule) }}</dd>
          </div>
          <div>
            <dt class="font-medium text-muted">
              {{ t('schedules.fields.monthlyEquivalent') }}
            </dt>
            <dd>
              <MoneyAmount
                v-if="schedule.monthlyEquivalentCents !== null"
                :cents="schedule.monthlyEquivalentCents"
              />
              <span v-else class="text-muted">{{
                t('schedules.notCounted')
              }}</span>
            </dd>
          </div>
          <div>
            <dt class="font-medium text-muted">
              {{ t('operations.fields.source') }}
            </dt>
            <dd>{{ labels.scheduleSourceLabel(schedule) }}</dd>
          </div>
          <div v-if="schedule.categoryId !== null">
            <dt class="font-medium text-muted">
              {{ t('operations.fields.category') }}
            </dt>
            <dd>{{ referentials.categoryName(schedule.categoryId) }}</dd>
          </div>
          <div>
            <dt class="font-medium text-muted">
              {{ t('schedules.fields.businessDayRule') }}
            </dt>
            <dd>{{ labels.businessDayLabel(schedule.businessDayRule) }}</dd>
          </div>
          <div v-if="schedule.note !== null" class="sm:col-span-2">
            <dt class="font-medium text-muted">
              {{ t('operations.fields.note') }}
            </dt>
            <dd class="whitespace-pre-line">{{ schedule.note }}</dd>
          </div>
        </dl>

        <section class="flex flex-col gap-2">
          <h3 class="text-base font-semibold text-highlighted">
            {{ t('schedules.occurrences.title') }}
          </h3>
          <p v-if="occurrences.length === 0" class="text-sm text-muted">
            {{ t('schedules.occurrences.none') }}
          </p>
          <ul
            v-else
            class="flex flex-col divide-y divide-default"
            data-testid="schedule-occurrences"
          >
            <ListRow
              v-for="occurrence in occurrences"
              :key="occurrence.originalDate"
              wrap
              :data-testid="`occurrence-${occurrence.originalDate}`"
            >
              <div class="min-w-0 flex-1">
                <p
                  class="text-sm tabular-nums"
                  :class="
                    occurrence.status === 'skipped'
                      ? 'text-muted line-through'
                      : 'text-default'
                  "
                >
                  {{ formatDate(occurrence.effectiveDate) }}
                </p>
                <p
                  v-if="occurrence.effectiveDate !== occurrence.originalDate"
                  class="text-xs text-muted"
                >
                  {{
                    t('schedules.occurrences.originally', {
                      date: formatDate(occurrence.originalDate),
                    })
                  }}
                </p>
              </div>
              <UBadge
                v-if="occurrence.status === 'skipped'"
                :label="t('schedules.occurrences.skipped')"
                color="neutral"
                variant="soft"
              />
              <UBadge
                v-else-if="occurrence.overridden"
                :label="t('schedules.occurrences.overridden')"
                color="neutral"
                variant="soft"
              />
              <MoneyAmount
                :cents="signed(occurrence.amountCents)"
                variant="flow"
                class="text-sm"
              />
              <template v-if="occurrence.editable">
                <template v-if="occurrence.status === 'pending'">
                  <OfflineGuard v-slot="{ offline }">
                    <UButton
                      :icon="icons.edit"
                      :aria-label="t('schedules.occurrences.edit')"
                      color="neutral"
                      variant="ghost"
                      :disabled="offline || busy"
                      data-testid="occurrence-edit"
                      @click="editOccurrence(occurrence)"
                    />
                  </OfflineGuard>
                  <OfflineGuard v-slot="{ offline }">
                    <UButton
                      :icon="icons.skip"
                      :aria-label="t('schedules.occurrences.skip')"
                      color="neutral"
                      variant="ghost"
                      :disabled="offline || busy"
                      data-testid="occurrence-skip"
                      @click="skip(occurrence)"
                    />
                  </OfflineGuard>
                </template>
                <OfflineGuard
                  v-if="
                    occurrence.status === 'skipped' || occurrence.overridden
                  "
                  v-slot="{ offline }"
                >
                  <UButton
                    :icon="icons.restoreOccurrence"
                    :aria-label="t('schedules.occurrences.restore')"
                    color="neutral"
                    variant="ghost"
                    :disabled="offline || busy"
                    data-testid="occurrence-restore"
                    @click="restore(occurrence)"
                  />
                </OfflineGuard>
              </template>
            </ListRow>
          </ul>
        </section>
      </div>
    </template>
    <template #footer>
      <div
        v-if="schedule !== null"
        class="flex w-full flex-wrap justify-end gap-2"
      >
        <OfflineGuard v-slot="{ offline }">
          <UButton
            :disabled="offline"
            :label="t('common.delete')"
            :icon="icons.delete"
            color="error"
            variant="soft"
            data-testid="schedule-delete"
            @click="deleteOpen = true"
          />
        </OfflineGuard>
        <OfflineGuard v-slot="{ offline }">
          <UButton
            :disabled="offline"
            :label="
              schedule.active
                ? t('schedules.deactivate')
                : t('schedules.activate')
            "
            :icon="schedule.active ? icons.deactivate : icons.activate"
            color="neutral"
            variant="outline"
            :loading="busy"
            data-testid="schedule-toggle-active"
            @click="toggleActive"
          />
        </OfflineGuard>
        <OfflineGuard v-slot="{ offline }">
          <UButton
            :disabled="offline"
            :label="t('common.edit')"
            :icon="icons.edit"
            color="primary"
            variant="soft"
            data-testid="schedule-edit"
            @click="emit('edit', schedule)"
          />
        </OfflineGuard>
      </div>
    </template>
  </UModal>

  <OccurrenceFormModal
    v-if="schedule !== null"
    v-model:open="occurrenceFormOpen"
    :schedule-id="schedule.id"
    :occurrence="editedOccurrence"
    @saved="occurrenceSaved"
  />

  <ConfirmModal
    v-model:open="deleteOpen"
    :title="t('schedules.deleteTitle')"
    :description="t('schedules.deleteEffect', { label: schedule?.label ?? '' })"
    :confirm-label="t('common.delete')"
    :pending="busy"
    @confirm="deleteSchedule"
  />
</template>
