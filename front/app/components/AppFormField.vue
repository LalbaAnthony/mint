<script setup lang="ts">
import type { AppFormFieldProps } from '~~/types/components'

defineProps<AppFormFieldProps>()
</script>

<template>
  <UFormField
    :label="label"
    :name="name"
    :hint="hint"
    :ui="{ hint: 'text-xs font-medium' }"
  >
    <slot />
    <template #error="{ error }">
      <span
        v-if="typeof error === 'string'"
        class="flex items-center gap-1 text-error"
      >
        <UIcon :name="icons.error" class="size-4 shrink-0" />
        {{ error }}
      </span>
    </template>
  </UFormField>
</template>
