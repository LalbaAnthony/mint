<script setup lang="ts">
import type { ShortcutGroup, ShortcutHelpSection } from '~~/types/shortcuts'

const groups: ShortcutGroup[] = ['general', 'views', 'forms']

const { t } = useI18n()
const shortcuts = useShortcutsStore()

const sections = computed<ShortcutHelpSection[]>(() =>
  groups.map((group) => ({
    group,
    title: t(`shortcuts.groups.${group}`),
    rows: shortcutDefinitions
      .filter((definition) => definition.group === group)
      .map((definition) => ({
        id: definition.id,
        label: t(`shortcuts.actions.${definition.id}`),
        kbds: shortcutKbds(definition.keys),
      })),
  })),
)
</script>

<template>
  <UModal
    v-model:open="shortcuts.helpOpen"
    :title="t('shortcuts.title')"
    :description="t('shortcuts.description')"
  >
    <template #body>
      <div class="flex flex-col gap-6" data-testid="shortcut-help">
        <section
          v-for="section in sections"
          :key="section.group"
          :aria-labelledby="`shortcut-help-${section.group}`"
        >
          <h3
            :id="`shortcut-help-${section.group}`"
            class="text-base font-semibold text-highlighted"
          >
            {{ section.title }}
          </h3>
          <dl class="mt-2 divide-y divide-default">
            <div
              v-for="row in section.rows"
              :key="row.id"
              class="flex items-center justify-between gap-4 py-2"
              :data-testid="`shortcut-help-${row.id}`"
            >
              <dt class="text-sm text-default">{{ row.label }}</dt>
              <dd class="flex shrink-0 gap-1">
                <UKbd
                  v-for="(kbd, index) in row.kbds"
                  :key="index"
                  :value="kbd"
                />
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </template>
  </UModal>
</template>
