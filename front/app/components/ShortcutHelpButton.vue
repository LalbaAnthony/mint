<script setup lang="ts">
const shortcuts = useShortcutsStore()
const { t } = useI18n()
const hint = useShortcutHint('help')
</script>

<template>
  <ShortcutTooltip
    v-if="hint !== undefined"
    :hint="hint"
    :text="t('shortcuts.title')"
  >
    <UButton
      color="neutral"
      variant="ghost"
      square
      :class="touchIconButtonClass"
      :aria-label="t('shortcuts.title')"
      data-testid="shortcut-help-button"
      @click="shortcuts.helpOpen = true"
    >
      <UIcon :name="icons.keyboard" class="size-5" aria-hidden="true" />
    </UButton>
  </ShortcutTooltip>
</template>
