<script setup lang="ts">
import type { AppFormFieldProps } from '~~/types/components'

const props = defineProps<AppFormFieldProps>()

const field = useTemplateRef('field')

useAutofocusField({
  name: () => props.name,
  element: () => {
    const element: unknown = field.value?.$el
    return element instanceof HTMLElement ? element : null
  },
})
</script>

<template>
  <UFormField
    ref="field"
    :label="label"
    :name="name"
    :hint="hint"
    :error="error"
    :ui="{ hint: 'text-xs font-medium', error: 'empty:hidden' }"
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
