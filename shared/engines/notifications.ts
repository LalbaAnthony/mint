import type { AccountInput } from '../types/accounts.js'
import type { Forecast } from '../types/forecast.js'
import type {
  AlertEpisodeState,
  DueReminder,
  EpisodeDecision,
  LowBalanceWindow,
  NotificationContent,
  ReminderOccurrence,
} from '../types/notifications.js'
import { addDays } from './dates.js'

export const lowBalanceWindowDays = 7

export function lowBalanceWindows(
  forecast: Forecast,
  accounts: readonly AccountInput[],
  today: string,
): LowBalanceWindow[] {
  const windowEnd = addDays(today, lowBalanceWindowDays)
  return accounts.flatMap((account) => {
    const threshold = account.lowBalanceThresholdCents
    const projection = forecast.accounts.find(
      (candidate) => candidate.accountId === account.id,
    )
    if (account.archived || threshold === null || projection === undefined) {
      return []
    }
    const days = projection.days.filter((day) => day.date <= windowEnd)
    const [first] = days
    if (first === undefined) {
      return []
    }
    let minimum = first
    for (const day of days) {
      if (day.balanceCents < minimum.balanceCents) {
        minimum = day
      }
    }
    return [
      {
        accountId: account.id,
        thresholdCents: threshold,
        below: minimum.balanceCents < threshold,
        minCents: minimum.balanceCents,
        minDate: minimum.date,
      },
    ]
  })
}

export function episodeDecision(
  open: AlertEpisodeState | null,
  window: LowBalanceWindow,
): EpisodeDecision {
  if (!window.below) {
    return open === null ? { action: 'none' } : { action: 'close' }
  }
  if (open === null) {
    return { action: 'open', notify: true }
  }
  return {
    action: 'update',
    notify: window.minCents < open.lastNotifiedMinCents,
  }
}

export function dueReminders(
  occurrences: readonly ReminderOccurrence[],
  reminderDaysBefore: number,
  today: string,
): DueReminder[] {
  const ahead = addDays(today, reminderDaysBefore)
  return occurrences.flatMap((occurrence): DueReminder[] => {
    if (occurrence.status === 'skipped' || occurrence.matched) {
      return []
    }
    const reminder = {
      scheduleId: occurrence.scheduleId,
      originalDate: occurrence.originalDate,
      effectiveDate: occurrence.effectiveDate,
      amountCents: occurrence.amountCents,
    }
    if (occurrence.effectiveDate === today) {
      return [{ ...reminder, dueToday: true }]
    }
    if (
      reminderDaysBefore > 0 &&
      occurrence.effectiveDate === ahead &&
      occurrence.status === 'pending'
    ) {
      return [{ ...reminder, dueToday: false }]
    }
    return []
  })
}

function calendarLink(accountId: string, day: string): string {
  return `/calendar?account=${encodeURIComponent(accountId)}&day=${encodeURIComponent(day)}`
}

export function notificationLink(draft: NotificationContent): string {
  switch (draft.type) {
    case 'low_balance':
      return calendarLink(draft.payload.accountId, draft.payload.minDate)
    case 'manual_reminder':
      return calendarLink(draft.payload.accountId, draft.payload.effectiveDate)
    case 'deposit_cap':
      return draft.payload.scheduleId === null
        ? calendarLink(draft.payload.accountId, draft.payload.date)
        : `/schedules?schedule=${encodeURIComponent(draft.payload.scheduleId)}`
  }
}
