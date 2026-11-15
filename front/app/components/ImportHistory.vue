<script setup lang="ts">
import type { ImportHistoryEmits, ImportHistoryProps } from '~~/types/imports'

defineProps<ImportHistoryProps>()
const emit = defineEmits<ImportHistoryEmits>()

const { t } = useI18n()
const { formatDateTime } = useFormatters()
</script>

<template>
  <div data-testid="import-history">
    <p v-if="batches.length === 0" class="text-sm text-muted">
      {{ t('imports.historyEmpty') }}
    </p>
    <ul v-else class="flex flex-col divide-y divide-default">
      <li
        v-for="batch in batches"
        :key="batch.id"
        class="flex flex-wrap items-center gap-2 py-2"
        :data-testid="`import-batch-${batch.id}`"
      >
        <div class="min-w-0 flex-1">
          <p class="flex items-center gap-2 truncate text-sm text-default">
            <span class="truncate">{{ batch.filename }}</span>
            <UBadge
              :label="t(`imports.statuses.${batch.status}`)"
              :color="batch.status === 'validated' ? 'success' : 'neutral'"
              variant="soft"
              size="sm"
            />
          </p>
          <p class="text-xs text-muted tabular-nums">
            {{ formatDateTime(batch.validatedAt ?? batch.createdAt) }}
            ·
            {{
              t('imports.counts', {
                read: batch.rowsRead,
                created: batch.rowsCreated,
                duplicates: batch.rowsDuplicate,
                merged: batch.rowsMerged,
              })
            }}
          </p>
        </div>
        <template v-if="batch.status === 'pending'">
          <UButton
            :label="t('imports.resume')"
            color="primary"
            variant="soft"
            size="sm"
            :disabled="busy"
            @click="emit('resume', batch)"
          />
          <UButton
            :label="t('imports.abandon')"
            color="neutral"
            variant="ghost"
            size="sm"
            :disabled="busy"
            @click="emit('abandon', batch)"
          />
        </template>
        <UButton
          v-else-if="batch.status === 'validated'"
          :label="t('imports.cancel')"
          color="error"
          variant="outline"
          size="sm"
          :disabled="busy"
          :data-testid="`import-cancel-${batch.id}`"
          @click="emit('cancel', batch)"
        />
      </li>
    </ul>
  </div>
</template>
