<script setup lang="ts">
const store = useAmountMaskStore()
const { t } = useI18n()
const hint = useShortcutHint('amountMask')
</script>

<template>
  <ShortcutTooltip :hint="hint" :text="t('amountMask.toggle')">
    <UButton
      color="neutral"
      variant="ghost"
      square
      :class="touchIconButtonClass"
      :aria-label="t('amountMask.toggle')"
      :aria-pressed="store.masked"
      :title="hint === undefined ? t('amountMask.toggle') : undefined"
      data-testid="amount-mask-toggle"
      @click="store.toggle()"
    >
      <UIcon
        :name="store.masked ? icons.amountsMasked : icons.amountsShown"
        class="size-5"
        aria-hidden="true"
      />
    </UButton>
  </ShortcutTooltip>
</template>
