import { describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { ids } from '../planning-fixtures'
import { setDefaultAccount, signIn, signOut } from '../session'

describe('forecast scope and default account (DSH-01, CAL-04, ADR 0033)', () => {
  it('opens on all accounts without default account', () => {
    const view = useForecastViewStore()

    expect(view.dashboardAccountId).toBeNull()
    expect(view.calendarAccountId).toBeNull()
  })

  it('follows the default account until the selector of a view changes', async () => {
    setDefaultAccount(ids.current)
    await nextTick()
    const view = useForecastViewStore()

    expect(view.dashboardAccountId).toBe(ids.current)
    expect(view.calendarAccountId).toBe(ids.current)

    view.calendarAccountId = null

    expect(view.calendarAccountId).toBeNull()
    expect(view.dashboardAccountId).toBe(ids.current)
  })

  it('realigns both views when the default account changes', async () => {
    setDefaultAccount(ids.current)
    await nextTick()
    const view = useForecastViewStore()
    view.dashboardAccountId = null
    view.calendarAccountId = ids.livret

    setDefaultAccount(ids.livret)
    await nextTick()

    expect(view.dashboardAccountId).toBe(ids.livret)
    expect(view.calendarAccountId).toBe(ids.livret)
  })

  it('forgets the manual choice of the views at logout', async () => {
    setDefaultAccount(ids.current)
    await nextTick()
    const view = useForecastViewStore()
    view.calendarAccountId = null

    signOut()
    await nextTick()
    signIn('user', { defaultAccountId: ids.current })
    await nextTick()

    expect(view.calendarAccountId).toBe(ids.current)
  })
})
