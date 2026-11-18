import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it } from 'vitest'
import AppFormField from '~/components/AppFormField.vue'

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
