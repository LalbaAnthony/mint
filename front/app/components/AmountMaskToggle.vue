<script setup lang="ts">
const store = useAmountMaskStore()
const { t } = useI18n()
</script>

<template>
  <UButton
    color="neutral"
    variant="ghost"
    square
    :class="touchIconButtonClass"
    :aria-label="t('amountMask.toggle')"
    :aria-pressed="store.masked"
    :title="t('amountMask.toggle')"
    data-testid="amount-mask-toggle"
    @click="store.toggle()"
  >
    <UIcon
      :name="store.masked ? icons.amountsMasked : icons.amountsShown"
      class="size-5"
      aria-hidden="true"
    />
  </UButton>
</template>
