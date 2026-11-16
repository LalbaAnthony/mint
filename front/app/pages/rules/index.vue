<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import {
  ruleListResponseSchema,
  ruleSchema,
  ruleSuggestionSchema,
} from '@mint/shared/schemas/rules'
import type { Rule, RuleSuggestion } from '@mint/shared/types/rules'

const { t } = useI18n()
const connectivity = useConnectivityStore()
const toast = useToast()
const { errorMessage } = useFormValidation()
const { formatMoney } = useFormatters()
const referentials = useReferentialsStore()
const route = useRoute()
const router = useRouter()

const rules = ref<Rule[] | null>(null)
const reordering = ref(false)
const busy = ref(false)

function notifyFailure(error: unknown): void {
  toast.add({ title: errorMessage(error), icon: icons.error, color: 'error' })
}

async function load(): Promise<void> {
  try {
    const [list] = await Promise.all([
      apiGet('/rules', ruleListResponseSchema),
      referentials.load(),
    ])
    rules.value = list
  } catch (error) {
    notifyFailure(error)
  }
}

const formOpen = ref(false)
const editedRule = ref<Rule | null>(null)
const draft = ref<RuleSuggestion | null>(null)

function openForm(rule: Rule | null, suggestion: RuleSuggestion | null): void {
  editedRule.value = rule
  draft.value = suggestion
  formOpen.value = true
}

async function openSuggestion(operationId: string): Promise<void> {
  try {
    const suggestion = await apiGet(
      `/rules/suggestion?operationId=${operationId}`,
      ruleSuggestionSchema,
    )
    openForm(null, suggestion)
  } catch (error) {
    notifyFailure(error)
  } finally {
    await router.replace({ query: {} })
  }
}

onMounted(async () => {
  await load()
  const operationId = route.query.operation
  if (typeof operationId === 'string') {
    await openSuggestion(operationId)
  }
})

async function saved(rule: Rule): Promise<void> {
  toast.add({
    title: t('rules.saved', { pattern: rule.pattern }),
    icon: icons.success,
    color: 'success',
  })
  await load()
}

const list = useTemplateRef<HTMLElement>('list')

async function reorder(ruleIds: string[]): Promise<void> {
  busy.value = true
  try {
    await apiCommand('POST', '/rules/reorder', { ruleIds })
    await load()
  } catch (error) {
    notifyFailure(error)
    await load()
  } finally {
    busy.value = false
  }
}

const { move } = useSortableList(list, {
  scope: 'rule',
  ids: () => (rules.value ?? []).map((rule) => rule.id),
  onReorder: (ids) => void reorder(ids),
})

async function toggle(rule: Rule): Promise<void> {
  try {
    await apiCall('PATCH', `/rules/${rule.id}`, ruleSchema, {
      active: !rule.active,
    })
    await load()
  } catch (error) {
    notifyFailure(error)
  }
}

const ruleToDelete = ref<Rule | null>(null)
const deleteOpen = computed({
  get: () => ruleToDelete.value !== null,
  set: (open) => {
    if (!open) {
      ruleToDelete.value = null
    }
  },
})

async function deleteRule(): Promise<void> {
  const rule = ruleToDelete.value
  if (rule === null) {
    return
  }
  busy.value = true
  try {
    await apiCommand('DELETE', `/rules/${rule.id}`)
    ruleToDelete.value = null
    await load()
  } catch (error) {
    notifyFailure(error)
  } finally {
    busy.value = false
  }
}

function actionsOf(rule: Rule): DropdownMenuItem[][] {
  return [
    [
      {
        label: t('common.edit'),
        icon: icons.edit,
        disabled: connectivity.offline,
        onSelect: () => openForm(rule, null),
      },
      {
        label: rule.active ? t('rules.deactivate') : t('rules.activate'),
        icon: rule.active ? icons.deactivate : icons.activate,
        disabled: connectivity.offline,
        onSelect: () => void toggle(rule),
      },
    ],
    [
      {
        label: t('common.delete'),
        icon: icons.delete,
        color: 'error',
        disabled: connectivity.offline,
        onSelect: () => {
          ruleToDelete.value = rule
        },
      },
    ],
  ]
}

function conditionOf(rule: Rule): string {
  const parts = [
    t(`rules.matchTypes.${rule.matchType}`),
    t('rules.quoted', { pattern: rule.pattern }),
  ]
  if (rule.accountId !== null) {
    parts.push(
      t('rules.onAccount', {
        account: referentials.accountName(rule.accountId),
      }),
    )
  }
  if (rule.sign !== 'any') {
    parts.push(t(`rules.signs.${rule.sign}`))
  }
  if (rule.amountMinCents !== null || rule.amountMaxCents !== null) {
    parts.push(
      t('rules.between', {
        min:
          rule.amountMinCents === null
            ? t('rules.unbounded')
            : formatMoney(rule.amountMinCents),
        max:
          rule.amountMaxCents === null
            ? t('rules.unbounded')
            : formatMoney(rule.amountMaxCents),
      }),
    )
  }
  return parts.join(' · ')
}

function actionOf(rule: Rule): string {
  return rule.transferAccountId === null
    ? referentials.categoryName(rule.categoryId)
    : t('operations.transferWith', {
        account: referentials.accountName(rule.transferAccountId),
      })
}
</script>

<template>
  <ViewPanel :title="t('navigation.rules')">
    <template #actions>
      <OfflineGuard v-if="(rules?.length ?? 0) > 1" v-slot="{ offline }">
        <UButton
          :disabled="offline"
          :icon="icons.reorder"
          :label="reordering ? t('common.doneReordering') : t('common.reorder')"
          color="neutral"
          variant="ghost"
          data-testid="rules-reorder"
          @click="reordering = !reordering"
        />
      </OfflineGuard>
      <OfflineGuard v-slot="{ offline }">
        <UButton
          :disabled="offline"
          :icon="icons.add"
          :aria-label="t('rules.add')"
          color="primary"
          variant="soft"
          data-testid="rules-add"
          @click="openForm(null, null)"
        >
          <span class="max-sm:sr-only">{{ t('rules.add') }}</span>
        </UButton>
      </OfflineGuard>
    </template>

    <UCard v-if="rules !== null" data-testid="rules-list">
      <EmptyState
        v-if="rules.length === 0"
        :icon="icons.rules"
        :title="t('rules.emptyTitle')"
        :description="t('rules.emptyText')"
      >
        <OfflineGuard v-slot="{ offline }">
          <UButton
            :disabled="offline"
            :label="t('rules.add')"
            :icon="icons.add"
            color="primary"
            variant="soft"
            @click="openForm(null, null)"
          />
        </OfflineGuard>
      </EmptyState>
      <template v-else>
        <p class="pb-2 text-xs text-muted">{{ t('rules.priorityHelp') }}</p>
        <ol ref="list" class="flex flex-col divide-y divide-default">
          <li
            v-for="(rule, index) in rules"
            :key="rule.id"
            data-sortable-item="rule"
            class="flex items-center gap-2 py-2"
            :data-testid="`rule-${rule.id}`"
          >
            <span
              v-if="reordering"
              data-drag-handle="rule"
              class="flex size-8 shrink-0 cursor-grab touch-none items-center justify-center text-muted max-lg:size-11"
              aria-hidden="true"
            >
              <UIcon :name="icons.dragHandle" class="size-5" />
            </span>
            <span class="w-6 shrink-0 text-xs text-muted tabular-nums">
              {{ index + 1 }}
            </span>
            <div class="min-w-0 flex-1">
              <p
                class="truncate text-sm"
                :class="rule.active ? 'text-default' : 'text-muted'"
              >
                {{ conditionOf(rule) }}
              </p>
              <p class="truncate text-xs text-muted">→ {{ actionOf(rule) }}</p>
            </div>
            <UBadge
              v-if="!rule.active"
              :label="t('rules.inactive')"
              color="neutral"
              variant="soft"
            />
            <template v-if="reordering">
              <UButton
                :icon="icons.moveUp"
                :aria-label="t('common.moveUp', { name: rule.pattern })"
                :disabled="index === 0 || busy"
                color="neutral"
                variant="ghost"
                square
                @click="move(index, -1)"
              />
              <UButton
                :icon="icons.moveDown"
                :aria-label="t('common.moveDown', { name: rule.pattern })"
                :disabled="index === rules.length - 1 || busy"
                color="neutral"
                variant="ghost"
                square
                @click="move(index, 1)"
              />
            </template>
            <UDropdownMenu v-else :items="actionsOf(rule)">
              <UButton
                :icon="icons.rowActions"
                :aria-label="t('common.actionsFor', { name: rule.pattern })"
                color="neutral"
                variant="ghost"
                class="size-11 justify-center lg:size-auto"
              />
            </UDropdownMenu>
          </li>
        </ol>
      </template>
    </UCard>

    <RuleFormModal
      v-model:open="formOpen"
      :rule="editedRule"
      :draft="draft"
      @saved="saved"
    />
    <ConfirmModal
      v-model:open="deleteOpen"
      :title="t('rules.deleteTitle')"
      :description="t('rules.deleteEffect')"
      :confirm-label="t('common.delete')"
      :pending="busy"
      @confirm="deleteRule"
    />
  </ViewPanel>
</template>
