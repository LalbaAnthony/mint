import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'
import { UForm } from '#components'
import AppFormField from '~/components/AppFormField.vue'

function formWithError(message: string | null) {
  return defineComponent({
    setup: () => () =>
      h(
        UForm,
        {
          state: { theme: '' },
          validate: () =>
            message === null ? [] : [{ name: 'theme', message }],
        },
        {
          default: () =>
            h(
              AppFormField,
              { label: 'Thème', name: 'theme' },
              { default: () => h('input', { name: 'theme' }) },
            ),
        },
      ),
  })
}

async function submit(
  wrapper: Awaited<ReturnType<typeof mountSuspended>>,
): Promise<void> {
  await wrapper.get('form').trigger('submit')
  await new Promise((resolve) => setTimeout(resolve, 0))
  await nextTick()
}

describe('AppFormField (CHG-30)', () => {
  it('renders the hint as a text-xs 500 muted help text', async () => {
    const wrapper = await mountSuspended(AppFormField, {
      props: { label: 'Thème', name: 'theme', hint: 'Aide' },
    })

    const hint = wrapper.get('[data-slot="hint"]')
    expect(hint.text()).toBe('Aide')
    expect(hint.classes()).toEqual(
      expect.arrayContaining(['text-xs', 'font-medium', 'text-muted']),
    )
  })

  it('renders no hint when none is given', async () => {
    const wrapper = await mountSuspended(AppFormField, {
      props: { label: 'Thème', name: 'theme' },
    })

    expect(wrapper.find('[data-slot="hint"]').exists()).toBe(false)
  })
})

describe('AppFormField error slot (CHG-69)', () => {
  it('hides the empty error container so the field ends at its input', async () => {
    const wrapper = await mountSuspended(formWithError(null))
    await submit(wrapper)

    const error = wrapper.get('[data-slot="error"]')
    expect(error.element.matches(':empty')).toBe(true)
    expect(error.classes()).toContain('empty:hidden')
  })

  it('shows the error message with its icon under the field', async () => {
    const wrapper = await mountSuspended(formWithError('Requis'))
    await submit(wrapper)

    const error = wrapper.get('[data-slot="error"]')
    expect(error.element.matches(':empty')).toBe(false)
    expect(error.text()).toBe('Requis')
    expect(error.find('.text-error').exists()).toBe(true)
  })
})
