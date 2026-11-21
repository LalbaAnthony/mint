<script setup lang="ts" generic="State extends object">
import type { AppFormEmits, AppFormProps } from '~~/types/components'

const props = defineProps<AppFormProps<State>>()
const emit = defineEmits<AppFormEmits>()

provideFieldAutofocus({
  values: () => props.state,
  pending: () => props.pending === true,
})
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
