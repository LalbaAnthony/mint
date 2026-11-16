<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type {
  CalendarOccurrenceMenuEmits,
  CalendarOccurrenceMenuProps,
} from '~~/types/forecast'

const props = defineProps<CalendarOccurrenceMenuProps>()
const emit = defineEmits<CalendarOccurrenceMenuEmits>()

const { t } = useI18n()
const connectivity = useConnectivityStore()

const items = computed<DropdownMenuItem[][]>(() => {
  const occurrence = props.occurrence
  const editable = occurrence.occurrence.editable
  const changes: DropdownMenuItem[] = [
    {
      label: t('schedules.occurrences.edit'),
      icon: icons.edit,
      disabled: !editable || connectivity.offline,
      onSelect: () => emit('action', { kind: 'edit', occurrence }),
    },
    {
      label: t('schedules.occurrences.skip'),
      icon: icons.skip,
      disabled: !editable || connectivity.offline,
      onSelect: () => emit('action', { kind: 'skip', occurrence }),
    },
  ]
  if (occurrence.occurrence.overridden) {
    changes.push({
      label: t('schedules.occurrences.restore'),
      icon: icons.restoreOccurrence,
      disabled: !editable || connectivity.offline,
      onSelect: () => emit('action', { kind: 'restore', occurrence }),
    })
  }
  return [
    changes,
    [
      {
        label: t('calendar.openSchedule'),
        icon: icons.schedules,
        onSelect: () => emit('action', { kind: 'openSchedule', occurrence }),
      },
    ],
  ]
})
</script>

<template>
  <slot v-if="occurrence.system" />
  <UDropdownMenu v-else :items="items" :content="{ align: 'start' }">
    <slot />
  </UDropdownMenu>
</template>
