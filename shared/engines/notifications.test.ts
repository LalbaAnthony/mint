import { describe, expect, it } from 'vitest'
import {
  account,
  forecastInput,
  recurrence,
  schedule,
} from '../tests/engine-fixtures.js'
import { computeForecast } from './forecast.js'
import {
  dueReminders,
  episodeDecision,
  lowBalanceWindows,
  notificationLink,
  upcomingManualPayments,
} from './notifications.js'

const current = '00000000-0000-4000-8000-000000000001'
const schedule1 = '00000000-0000-4000-8000-000000000002'

describe('low balance window (NOTIF-01, US-13)', () => {
  function windowFor(thresholdCents: number | null) {
    const accounts = [
      account({
        initialBalanceCents: 30_000,
        lowBalanceThresholdCents: thresholdCents,
      }),
      account({ id: 'livret-a', usage: 'savings', archived: true }),
    ]
    const forecast = computeForecast(
      forecastInput({
        accounts,
        schedules: [
          schedule({
            amountCents: 15_000,
            recurrence: recurrence({ startDate: '2026-11-15' }),
          }),
        ],
      }),
    )
    return lowBalanceWindows(forecast, accounts, '2026-11-11')
  }

  it('finds a minimum of 150 EUR in 4 days below a 200 EUR threshold', () => {
    expect(windowFor(20_000)).toEqual([
      {
        accountId: 'current',
        thresholdCents: 20_000,
        below: true,
        minCents: 15_000,
        minDate: '2026-11-15',
      },
    ])
  })

  it('ignores accounts without threshold and archived ones', () => {
    expect(windowFor(null)).toEqual([])
    expect(windowFor(10_000)[0]?.below).toBe(false)
  })
})

describe('alert episodes (NOTIF-01, US-13)', () => {
  const below = {
    accountId: 'current',
    thresholdCents: 20_000,
    below: true,
    minCents: 15_000,
    minDate: '2026-11-15',
  }
  const open = {
    id: 'episode',
    minCents: 15_000,
    minDate: '2026-11-15',
    lastNotifiedMinCents: 15_000,
  }

  it('opens and notifies an episode, then stays silent while nothing gets worse', () => {
    expect(episodeDecision(null, below)).toEqual({
      action: 'open',
      notify: true,
    })
    expect(episodeDecision(open, below)).toEqual({
      action: 'update',
      notify: false,
    })
  })

  it('notifies again when the minimum goes down to 100 EUR', () => {
    expect(episodeDecision(open, { ...below, minCents: 10_000 })).toEqual({
      action: 'update',
      notify: true,
    })
  })

  it('closes the episode once the window is back above the threshold', () => {
    expect(episodeDecision(open, { ...below, below: false })).toEqual({
      action: 'close',
    })
    expect(episodeDecision(null, { ...below, below: false })).toEqual({
      action: 'none',
    })
  })
})

describe('manual reminders (NOTIF-02, US-14)', () => {
  const occurrence = {
    scheduleId: 'transfer',
    originalDate: '2026-12-10',
    effectiveDate: '2026-12-10',
    amountCents: 10_000,
    status: 'pending' as const,
    matched: false,
  }

  it('reminds 2 days before and on the day, the generated operation included', () => {
    expect(dueReminders([occurrence], 2, '2026-12-08')).toEqual([
      {
        scheduleId: 'transfer',
        originalDate: '2026-12-10',
        effectiveDate: '2026-12-10',
        amountCents: 10_000,
        dueToday: false,
      },
    ])
    expect(
      dueReminders([{ ...occurrence, status: 'executed' }], 2, '2026-12-10'),
    ).toEqual([expect.objectContaining({ dueToday: true })])
    expect(dueReminders([occurrence], 2, '2026-12-09')).toEqual([])
  })

  it('reminds only on the day with a delay of 0, and never for a skipped or already paid occurrence', () => {
    expect(dueReminders([occurrence], 0, '2026-12-10')).toHaveLength(1)
    expect(
      dueReminders([{ ...occurrence, status: 'skipped' }], 2, '2026-12-10'),
    ).toEqual([])
    expect(
      dueReminders(
        [{ ...occurrence, status: 'executed', matched: true }],
        2,
        '2026-12-10',
      ),
    ).toEqual([])
    expect(
      dueReminders([{ ...occurrence, status: 'executed' }], 2, '2026-12-08'),
    ).toEqual([])
  })
})

describe('upcoming manual payments (DSH-04, NOTIF-02)', () => {
  const occurrence = {
    scheduleId: 'transfer',
    originalDate: '2026-12-10',
    effectiveDate: '2026-12-10',
    amountCents: 10_000,
    status: 'pending' as const,
    matched: false,
  }

  it('keeps the occurrences from today to the reminder delay of their schedule', () => {
    expect(upcomingManualPayments([occurrence], 2, '2026-12-08')).toEqual([
      occurrence,
    ])
    expect(upcomingManualPayments([occurrence], 2, '2026-12-07')).toEqual([])
    expect(upcomingManualPayments([occurrence], 3, '2026-12-07')).toEqual([
      occurrence,
    ])
    expect(upcomingManualPayments([occurrence], 2, '2026-12-11')).toEqual([])
  })

  it('keeps the occurrence of the day whatever its state, unless skipped', () => {
    const executed = { ...occurrence, status: 'executed' as const }
    expect(upcomingManualPayments([executed], 0, '2026-12-10')).toEqual([
      executed,
    ])
    expect(
      upcomingManualPayments(
        [{ ...occurrence, status: 'skipped' }],
        0,
        '2026-12-10',
      ),
    ).toEqual([])
  })

  it('leaves out a skipped, executed or already paid occurrence before its day', () => {
    expect(
      upcomingManualPayments(
        [
          { ...occurrence, status: 'skipped' },
          { ...occurrence, status: 'executed' },
          { ...occurrence, matched: true },
        ],
        2,
        '2026-12-08',
      ),
    ).toEqual([])
  })
})

describe('notification links (NOTIF-04, NOTIF-07)', () => {
  it('opens the calendar day of the account or the schedule detail', () => {
    expect(
      notificationLink({
        type: 'low_balance',
        payload: {
          accountId: current,
          accountName: 'Compte courant',
          minDate: '2026-11-15',
          minCents: 15_000,
          thresholdCents: 20_000,
        },
      }),
    ).toBe(`/calendar?account=${current}&day=2026-11-15`)
    expect(
      notificationLink({
        type: 'manual_reminder',
        payload: {
          scheduleId: schedule1,
          scheduleLabel: 'Epargne',
          kind: 'transfer',
          accountId: current,
          originalDate: '2026-12-10',
          effectiveDate: '2026-12-10',
          amountCents: 10_000,
          dueToday: false,
        },
      }),
    ).toBe(`/calendar?account=${current}&day=2026-12-10`)
    const cap = {
      accountId: current,
      accountName: 'LEP',
      scheduleId: schedule1,
      scheduleLabel: 'Versement',
      originalDate: '2026-12-06',
      date: '2026-12-06',
      excessCents: 5_000,
    }
    expect(notificationLink({ type: 'deposit_cap', payload: cap })).toBe(
      `/schedules?schedule=${schedule1}`,
    )
    expect(
      notificationLink({
        type: 'deposit_cap',
        payload: {
          ...cap,
          scheduleId: null,
          scheduleLabel: null,
          originalDate: null,
        },
      }),
    ).toBe(`/calendar?account=${current}&day=2026-12-06`)
  })
})
