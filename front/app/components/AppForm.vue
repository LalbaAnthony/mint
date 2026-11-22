<script setup lang="ts" generic="State extends object">
import { useCurrentElement } from '@vueuse/core'
import type { AppFormEmits, AppFormProps } from '~~/types/components'

const props = defineProps<AppFormProps<State>>()
const emit = defineEmits<AppFormEmits>()

const root = useCurrentElement()

provideFieldAutofocus({
  values: () => props.state,
  pending: () => props.pending === true,
})

useKeyboardCenteringScope(() =>
  root.value instanceof HTMLElement ? root.value : null,
)
</script>

<template>
  <UForm
    :state="state"
    :validate="validate"
    :validate-on="validateOn"
    @submit="emit('submit')"
  >
    <slot />
  </UForm>
</template>
