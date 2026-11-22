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

function formElement(): HTMLFormElement | null {
  return root.value instanceof HTMLFormElement ? root.value : null
}

function submitButton(form: HTMLFormElement): HTMLButtonElement | null {
  const button = form.querySelector('button[type="submit"]')
  return button instanceof HTMLButtonElement ? button : null
}

function submitContainer(): HTMLElement | null {
  const form = formElement()
  if (form === null || form.contains(document.activeElement)) {
    return form
  }
  const dialog = form.closest('[role="dialog"]')
  return dialog instanceof HTMLElement ? dialog : form
}

useShortcut(
  'submit',
  () => {
    const form = formElement()
    if (form === null) {
      return
    }
    const button = submitButton(form)
    if (button === null) {
      form.requestSubmit()
    } else {
      button.click()
    }
  },
  {
    enabled: () => {
      const form = formElement()
      return form !== null && submitButton(form)?.disabled !== true
    },
    container: submitContainer,
  },
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
