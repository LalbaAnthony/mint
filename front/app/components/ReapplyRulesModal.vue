<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import {
  applyRulesResponseSchema,
  reapplyRulesPreviewSchema,
  reapplySkipReasons,
  ruleListResponseSchema,
} from '@mint/shared/schemas/rules'
import type { Operation } from '@mint/shared/types/operations'
import type {
  ReapplyRuleChange,
  ReapplyRulesPreview,
  Rule,
} from '@mint/shared/types/rules'
import type {
  ReapplyRulesModalEmits,
  ReapplyRulesModalProps,
} from '~~/types/planning'

const props = defineProps<ReapplyRulesModalProps>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<ReapplyRulesModalEmits>()

const { t } = useI18n()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatDate } = useFormatters()
const referentials = useReferentialsStore()
const isDesktop = useMediaQuery('(min-width: 1024px)')

const preview = ref<ReapplyRulesPreview | null>(null)
const rules = ref<Rule[]>([])
const kept = ref<Set<string>>(new Set())
const applying = ref(false)

const previewState = useLoadState({
  onError: (error) => {
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
    open.value = false
  },
})

async function fetchPreview(): Promise<void> {
  const [previewed, ruleList] = await Promise.all([
    apiCall('POST', '/rules/reapply/preview', reapplyRulesPreviewSchema, {
      operationIds: props.operationIds,
    }),
    apiGet('/rules', ruleListResponseSchema),
  ])
  rules.value = ruleList
  preview.value = previewed
  kept.value = new Set(previewed.changes.map((change) => change.operation.id))
}

function loadPreview(): Promise<void> {
  preview.value = null
  return previewState.run(fetchPreview)
}

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      void loadPreview()
    }
  },
  { immediate: true },
)

function toggle(operationId: string): void {
  const next = new Set(kept.value)
  if (!next.delete(operationId)) {
    next.add(operationId)
  }
  kept.value = next
}

function currentClassification(operation: Operation): string {
  if (operation.transferGroupId !== null) {
    return t('operations.transferWith', {
      account: referentials.accountName(operation.counterpartAccountId),
    })
  }
  return operation.categoryId === null
    ? t('rules.reapply.uncategorized')
    : referentials.categoryName(operation.categoryId)
}

function nextClassification({ operation, after }: ReapplyRuleChange): string {
  if (
    after.categoryId === operation.categoryId &&
    after.transferAccountId === operation.counterpartAccountId
  ) {
    return t('rules.reapply.classificationKept')
  }
  if (after.transferAccountId !== null) {
    return t('operations.transferWith', {
      account: referentials.accountName(after.transferAccountId),
    })
  }
  return after.categoryId === null
    ? t('rules.reapply.uncategorized')
    : referentials.categoryName(after.categoryId)
}

function addedTagIds({ operation, after }: ReapplyRuleChange): string[] {
  return after.tagIds.filter((tagId) => !operation.tagIds.includes(tagId))
}

function ruleLabel(ruleId: string): string {
  const rule = rules.value.find((candidate) => candidate.id === ruleId)
  return rule === undefined
    ? ''
    : t('rules.reapply.rule', { pattern: rule.pattern })
}

const skippedCounts = computed(() =>
  reapplySkipReasons.flatMap((reason) => {
    const count =
      preview.value?.skipped.filter((skip) => skip.reason === reason).length ??
      0
    return count === 0 ? [] : [{ reason, count }]
  }),
)

async function apply(): Promise<void> {
  const current = preview.value
  if (current === null || kept.value.size === 0) {
    return
  }
  applying.value = true
  try {
    const result = await apiCall(
      'POST',
      '/rules/reapply',
      applyRulesResponseSchema,
      {
        changes: current.changes
          .filter((change) => kept.value.has(change.operation.id))
          .map((change) => change.after),
      },
    )
    toast.add({
      title: t('rules.reapply.applied', { n: result.updated }, result.updated),
      icon: icons.success,
      color: 'success',
    })
    emit('applied', result.updated)
    open.value = false
  } catch (error) {
    if (error instanceof ApiError && error.code === 'preview_outdated') {
      toast.add({
        title: t('rules.reapply.outdated'),
        icon: icons.info,
        color: 'info',
      })
      await loadPreview()
      return
    }
    toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
  } finally {
    applying.value = false
  }
}

const connectivity = useConnectivityStore()
const actions = useTemplateRef<HTMLElement>('actions')

useDialogSubmitShortcut(
  actions,
  () => {
    void apply()
  },
  () =>
    open.value &&
    !connectivity.offline &&
    kept.value.size > 0 &&
    !applying.value,
)
</script>

<template>
  <UModal
    v-model:open="open"
    :title="t('rules.reapply.title')"
    :description="t('rules.reapply.description')"
    :fullscreen="!isDesktop"
  >
    <template #body>
      <LoadZone
        v-if="preview === null"
        :state="previewState"
        :error-state="false"
        data-testid="reapply-loading"
      >
        <template #skeleton>
          <div class="flex flex-col gap-2">
            <SkeletonText width="lg" class="text-base" />
            <SkeletonList :row="{ gap: 3, align: 'start' }">
              <template #default="{ index }">
                <SkeletonControl kind="checkbox" class="pt-0.5" />
                <div class="min-w-0 flex-1 text-sm">
                  <SkeletonText :width="skeletonRowWidth(index)" />
                  <SkeletonText width="xl" class="text-xs" />
                </div>
              </template>
            </SkeletonList>
          </div>
        </template>
      </LoadZone>
      <div v-else class="flex flex-col gap-4" data-testid="reapply-preview">
        <p
          v-if="preview.changes.length === 0"
          class="text-sm text-muted"
          data-testid="reapply-no-change"
        >
          {{ t('rules.reapply.noChange') }}
        </p>
        <section v-else class="flex flex-col gap-2">
          <h3 class="text-base font-semibold text-highlighted">
            {{ t('rules.reapply.changes') }}
          </h3>
          <ul class="flex flex-col divide-y divide-default">
            <ListRow
              v-for="change in preview.changes"
              :key="change.operation.id"
              :gap="3"
              align="start"
              :data-testid="`reapply-change-${change.operation.id}`"
            >
              <UCheckbox
                :model-value="kept.has(change.operation.id)"
                :aria-label="
                  t('rules.reapply.keep', { label: change.operation.label })
                "
                class="pt-0.5"
                data-testid="reapply-keep"
                @update:model-value="toggle(change.operation.id)"
              />
              <div class="flex min-w-0 flex-1 flex-col gap-1 text-sm">
                <p class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-default">
                    {{ change.operation.label }}
                  </span>
                  <MoneyAmount
                    :cents="change.operation.amountCents"
                    variant="flow"
                  />
                </p>
                <p class="flex flex-wrap gap-x-2 text-xs text-muted">
                  <span class="tabular-nums">
                    {{ formatDate(change.operation.date) }}
                  </span>
                  <span>{{ ruleLabel(change.after.ruleId) }}</span>
                </p>
                <dl class="grid grid-cols-[auto_1fr] gap-x-2 text-xs">
                  <dt class="text-muted">{{ t('rules.reapply.before') }}</dt>
                  <dd class="text-default">
                    {{ currentClassification(change.operation) }}
                  </dd>
                  <dt class="text-muted">{{ t('rules.reapply.after') }}</dt>
                  <dd
                    class="font-medium text-highlighted"
                    data-testid="reapply-after"
                  >
                    {{ nextClassification(change) }}
                  </dd>
                  <template v-if="addedTagIds(change).length > 0">
                    <dt class="text-muted">
                      {{ t('rules.reapply.tagsAdded') }}
                    </dt>
                    <dd>
                      <TagBadges :tag-ids="addedTagIds(change)" />
                    </dd>
                  </template>
                </dl>
              </div>
            </ListRow>
          </ul>
        </section>
        <section v-if="skippedCounts.length > 0" class="flex flex-col gap-1">
          <h3 class="text-base font-semibold text-highlighted">
            {{ t('rules.reapply.skippedTitle') }}
          </h3>
          <ul class="text-sm text-muted" data-testid="reapply-skipped">
            <li v-for="{ reason, count } in skippedCounts" :key="reason">
              {{ t(`rules.reapply.skipped.${reason}`, { n: count }, count) }}
            </li>
          </ul>
        </section>
        <div ref="actions" class="flex flex-col gap-2 sm:flex-row-reverse">
          <OfflineGuard v-slot="{ offline }">
            <ShortcutTooltip shortcut="submit">
              <UButton
                :disabled="offline || kept.size === 0"
                :label="t('rules.reapply.confirm', { n: kept.size }, kept.size)"
                :loading="applying"
                color="primary"
                variant="solid"
                class="justify-center"
                data-testid="reapply-confirm"
                @click="apply"
              />
            </ShortcutTooltip>
          </OfflineGuard>
          <UButton
            :label="t('common.cancel')"
            color="neutral"
            variant="outline"
            class="justify-center"
            @click="open = false"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
