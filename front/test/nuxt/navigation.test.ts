import { mountSuspended } from '@nuxt/test-utils/runtime'
import { afterEach, describe, expect, it } from 'vitest'
import { signIn } from '../session'
import { defineComponent, h } from 'vue'

const NavigationProbe = defineComponent({
  setup() {
    return useNavigation()
  },
  render: () => h('div'),
})

afterEach(() => {
  signIn('user')
})

describe('useNavigation', () => {
  it('lists the main entries in the charter order (CHG-52, CHG-55)', async () => {
    const wrapper = await mountSuspended(NavigationProbe)

    expect(wrapper.vm.mainEntries.map((entry) => entry.label)).toEqual([
      'Accueil',
      'Comptes',
      'Calendrier',
      'Opérations',
    ])
    expect(wrapper.vm.mainEntries.map((entry) => entry.icon)).toEqual([
      'lucide:layout-dashboard',
      'lucide:wallet',
      'lucide:calendar-days',
      'lucide:receipt',
    ])
  })

  it('lists the drawer entries in the charter order (CHG-53)', async () => {
    const wrapper = await mountSuspended(NavigationProbe)

    expect(wrapper.vm.moreEntries.map((entry) => entry.to)).toEqual([
      '/schedules',
      '/subscriptions',
      '/envelopes',
      '/import',
      '/rules',
      '/profile',
    ])
    expect(wrapper.vm.profileEntry.label).toBe('Profil et préférences')
  })

  it('adds administration for an administrator only', async () => {
    const wrapper = await mountSuspended(NavigationProbe)

    expect(wrapper.vm.administrationEntries).toEqual([])

    signIn('admin')

    expect(wrapper.vm.administrationEntries.map((entry) => entry.to)).toEqual([
      '/admin',
    ])
    expect(wrapper.vm.moreEntries.at(-1)?.label).toBe('Administration')
  })

  it('offers expense, income and transfer, disabled for now', async () => {
    const wrapper = await mountSuspended(NavigationProbe)

    expect(wrapper.vm.quickAddEntries).toEqual([
      {
        kind: 'expense',
        label: 'Dépense',
        icon: 'lucide:arrow-up-right',
        disabled: true,
      },
      {
        kind: 'income',
        label: 'Revenu',
        icon: 'lucide:arrow-down-left',
        disabled: true,
      },
      {
        kind: 'transfer',
        label: 'Transfert',
        icon: 'lucide:arrow-left-right',
        disabled: true,
      },
    ])
  })

  it.each([
    ['/', false],
    ['/accounts', false],
    ['/schedules', true],
    ['/profile', true],
  ])('marks More as active on %s: %s', async (route, expected) => {
    const wrapper = await mountSuspended(NavigationProbe, { route })

    expect(wrapper.vm.isMoreActive).toBe(expected)
  })
})
