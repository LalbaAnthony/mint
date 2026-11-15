import { Op, QueryTypes } from 'sequelize'
import type { Transaction } from 'sequelize'
import { calculatedBalanceCents } from '@mint/shared/engines/balances'
import { addDays } from '@mint/shared/engines/dates'
import { computeForecast } from '@mint/shared/engines/forecast'
import { balanceExcludingInterest } from '@mint/shared/engines/interest'
import {
  dueReminders,
  episodeDecision,
  lowBalanceWindows,
} from '@mint/shared/engines/notifications'
import {
  activeAccountsById,
  postingStartDate,
} from '@mint/shared/engines/postings'
import { occurrencesBetween } from '@mint/shared/engines/recurrence'
import { pushNotificationTypes } from '@mint/shared/schemas/notifications'
import { maxReminderDaysBefore } from '@mint/shared/schemas/schedules'
import type { AccountInput } from '@mint/shared/types/accounts'
import type { Forecast } from '@mint/shared/types/forecast'
import type { NotificationDraft } from '@mint/shared/types/notifications'
import { parisDate } from '../clock.js'
import { loadForecastData } from '../forecast/views.js'
import { loadAccountInputs, loadScheduleInputs } from '../planning/inputs.js'
import { insertedIdRowsSchema } from '../schemas/planning.js'
import type { ForecastData } from '../types/forecast.js'
import type { AlertEpisodeModel, UserModel } from '../types/models.js'
import type {
  AlertDelivery,
  EvaluationOptions,
  NotificationContext,
} from '../types/notifications.js'
import { pushMessage } from './messages.js'

async function accountNames(
  context: NotificationContext,
  userId: string,
): Promise<Map<string, string>> {
  const accounts = await context.models.Account.findAll({
    attributes: ['id', 'name'],
    where: { userId },
  })
  return new Map(accounts.map((account) => [account.id, account.name]))
}

async function lowBalanceDrafts(
  context: NotificationContext,
  userId: string,
  accounts: readonly AccountInput[],
  forecast: Forecast,
  today: string,
  names: ReadonlyMap<string, string>,
  openEpisodes: readonly AlertEpisodeModel[],
): Promise<NotificationDraft[]> {
  const drafts: NotificationDraft[] = []
  const now = context.clock.now()
  const watched = new Set<string>()
  for (const window of lowBalanceWindows(forecast, accounts, today)) {
    watched.add(window.accountId)
    const open =
      openEpisodes.find((episode) => episode.accountId === window.accountId) ??
      null
    const decision = episodeDecision(open, window)
    let episode = open
    switch (decision.action) {
      case 'none':
        continue
      case 'close':
        await open?.update({ closedAt: now })
        continue
      case 'open':
        episode = await context.models.AlertEpisode.create({
          userId,
          accountId: window.accountId,
          openedAt: now,
          minCents: window.minCents,
          minDate: window.minDate,
          lastNotifiedMinCents: window.minCents,
        })
        break
      case 'update':
        await open?.update({
          minCents: window.minCents,
          minDate: window.minDate,
          ...(decision.notify ? { lastNotifiedMinCents: window.minCents } : {}),
        })
        break
    }
    if (episode === null || !decision.notify) {
      continue
    }
    drafts.push({
      type: 'low_balance',
      dedupKey: `low_balance:${episode.id}:${window.minCents}`,
      payload: {
        accountId: window.accountId,
        accountName: names.get(window.accountId) ?? '',
        minDate: window.minDate,
        minCents: window.minCents,
        thresholdCents: window.thresholdCents,
      },
    })
  }
  for (const episode of openEpisodes) {
    if (!watched.has(episode.accountId)) {
      await episode.update({ closedAt: now })
    }
  }
  return drafts
}

function capDrafts(
  forecastData: ForecastData,
  forecast: Forecast,
  today: string,
  names: ReadonlyMap<string, string>,
): NotificationDraft[] {
  const drafts: NotificationDraft[] = []
  for (const account of forecast.accounts) {
    for (const day of account.days) {
      for (const flow of day.flows) {
        if (flow.source !== 'occurrence' || flow.capExcessCents === null) {
          continue
        }
        drafts.push({
          type: 'deposit_cap',
          dedupKey: `deposit_cap:occurrence:${flow.scheduleId}:${flow.originalDate}`,
          payload: {
            accountId: account.accountId,
            accountName: names.get(account.accountId) ?? '',
            scheduleId: flow.scheduleId,
            scheduleLabel: flow.label,
            originalDate: flow.originalDate,
            date: flow.effectiveDate,
            excessCents: flow.capExcessCents,
          },
        })
      }
    }
  }
  for (const account of forecastData.accounts) {
    if (account.archived || account.depositCapCents === null) {
      continue
    }
    const balance = calculatedBalanceCents(
      account,
      forecastData.operations,
      today,
    )
    if (balance === null) {
      continue
    }
    const excess =
      balanceExcludingInterest(
        account,
        forecastData.operations,
        balance,
        today,
        forecastData.interestCategoryId,
      ) - account.depositCapCents
    if (excess > 0) {
      drafts.push({
        type: 'deposit_cap',
        dedupKey: `deposit_cap:account:${account.id}:${today}`,
        payload: {
          accountId: account.id,
          accountName: names.get(account.id) ?? '',
          scheduleId: null,
          scheduleLabel: null,
          originalDate: null,
          date: today,
          excessCents: excess,
        },
      })
    }
  }
  return drafts
}

async function matchedOccurrences(
  context: NotificationContext,
  scheduleIds: readonly string[],
  from: string,
  to: string,
): Promise<Set<string>> {
  if (scheduleIds.length === 0) {
    return new Set()
  }
  const executed = await context.models.ScheduleOccurrence.findAll({
    attributes: ['id', 'scheduleId', 'originalDate'],
    where: {
      scheduleId: { [Op.in]: [...scheduleIds] },
      state: 'executed',
      originalDate: { [Op.between]: [addDays(from, -7), to] },
    },
  })
  if (executed.length === 0) {
    return new Set()
  }
  const paid = await context.models.Transaction.findAll({
    attributes: ['occurrenceId'],
    where: {
      occurrenceId: { [Op.in]: executed.map((row) => row.id) },
      origin: { [Op.ne]: 'schedule' },
    },
  })
  const paidIds = new Set(
    paid.flatMap((operation) => operation.occurrenceId ?? []),
  )
  return new Set(
    executed
      .filter((row) => paidIds.has(row.id))
      .map((row) => `${row.scheduleId}|${row.originalDate}`),
  )
}

async function reminderDrafts(
  context: NotificationContext,
  userId: string,
  accounts: readonly AccountInput[],
  today: string,
): Promise<NotificationDraft[]> {
  const schedules = await context.models.Schedule.findAll({
    where: { userId, triggerMode: 'manual', active: true, isSystem: false },
  })
  if (schedules.length === 0) {
    return []
  }
  const inputs = await loadScheduleInputs(context, userId)
  const activeAccounts = activeAccountsById(accounts)
  const until = addDays(today, maxReminderDaysBefore)
  const matched = await matchedOccurrences(
    context,
    schedules.map((schedule) => schedule.id),
    today,
    until,
  )
  return schedules.flatMap((schedule) => {
    const input = inputs.find((candidate) => candidate.id === schedule.id)
    if (
      input === undefined ||
      postingStartDate(input, activeAccounts) === null
    ) {
      return []
    }
    const accountId =
      input.posting.kind === 'transfer'
        ? input.posting.sourceAccountId
        : input.posting.accountId
    const occurrences = occurrencesBetween(input, today, until).map(
      (occurrence) => ({
        scheduleId: schedule.id,
        originalDate: occurrence.originalDate,
        effectiveDate: occurrence.effectiveDate,
        amountCents: occurrence.amountCents,
        status: occurrence.status,
        matched: matched.has(`${schedule.id}|${occurrence.originalDate}`),
      }),
    )
    return dueReminders(occurrences, schedule.reminderDaysBefore, today).map(
      (reminder): NotificationDraft => ({
        type: 'manual_reminder',
        dedupKey: `manual_reminder:${reminder.scheduleId}:${reminder.originalDate}:${reminder.dueToday ? 'day' : 'before'}`,
        payload: {
          scheduleId: schedule.id,
          scheduleLabel: schedule.label,
          kind: schedule.kind,
          accountId,
          originalDate: reminder.originalDate,
          effectiveDate: reminder.effectiveDate,
          amountCents: reminder.amountCents,
          dueToday: reminder.dueToday,
        },
      }),
    )
  })
}

async function insertNotification(
  context: NotificationContext,
  userId: string,
  draft: NotificationDraft,
  transaction?: Transaction,
): Promise<boolean> {
  const rows = await context.sequelize.query(
    `INSERT INTO notifications (user_id, type, payload, dedup_key)
     VALUES (:userId, :type, CAST(:payload AS jsonb), :dedupKey)
     ON CONFLICT (user_id, dedup_key) DO NOTHING
     RETURNING id`,
    {
      replacements: {
        userId,
        type: draft.type,
        payload: JSON.stringify(draft.payload),
        dedupKey: draft.dedupKey,
      },
      type: QueryTypes.SELECT,
      transaction,
    },
  )
  return insertedIdRowsSchema.parse(rows).length > 0
}

async function pushDraft(
  context: NotificationContext,
  user: UserModel,
  draft: NotificationDraft,
): Promise<number> {
  const sender = context.push
  if (sender === null) {
    return 0
  }
  const subscriptions = await context.models.PushSubscription.findAll({
    where: { userId: user.id },
  })
  let pushed = 0
  for (const subscription of subscriptions) {
    const outcome = await sender.send(
      {
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
      pushMessage(draft, user.locale),
    )
    if (outcome === 'gone') {
      await subscription.destroy()
    } else if (outcome === 'sent') {
      pushed += 1
      await subscription.update({ lastSuccessAt: context.clock.now() })
    }
  }
  return pushed
}

async function deliver(
  context: NotificationContext,
  user: UserModel,
  drafts: readonly NotificationDraft[],
): Promise<AlertDelivery> {
  const preferences = await context.models.NotificationPreference.findAll({
    where: { userId: user.id },
  })
  const pushEnabled = (type: NotificationDraft['type']) =>
    pushNotificationTypes.some((candidate) => candidate === type) &&
    (preferences.find((preference) => preference.type === type)?.push ?? true)
  const delivery: AlertDelivery = { created: 0, pushed: 0 }
  for (const draft of drafts) {
    if (!(await insertNotification(context, user.id, draft))) {
      continue
    }
    delivery.created += 1
    if (pushEnabled(draft.type)) {
      delivery.pushed += await pushDraft(context, user, draft)
    }
  }
  return delivery
}

export async function evaluateUserAlerts(
  context: NotificationContext,
  userId: string,
  options: EvaluationOptions,
): Promise<AlertDelivery> {
  const user = await context.models.User.findByPk(userId)
  if (user === null || user.status !== 'active') {
    return { created: 0, pushed: 0 }
  }
  const today = parisDate(context.clock.now())
  const accounts = await loadAccountInputs(context, userId)
  const openEpisodes = await context.models.AlertEpisode.findAll({
    where: { userId, closedAt: null },
  })
  const watched = accounts.some(
    (account) =>
      !account.archived &&
      (account.lowBalanceThresholdCents !== null ||
        account.depositCapCents !== null),
  )
  const drafts: NotificationDraft[] = []
  if (watched || openEpisodes.length > 0) {
    const names = await accountNames(context, userId)
    const forecastData = await loadForecastData(context, userId)
    const forecast = computeForecast({
      today,
      horizonMonths: user.forecastHorizonMonths,
      ...forecastData,
    })
    drafts.push(
      ...(await lowBalanceDrafts(
        context,
        userId,
        forecastData.accounts,
        forecast,
        today,
        names,
        openEpisodes,
      )),
      ...capDrafts(forecastData, forecast, today, names),
    )
  }
  if (options.reminders) {
    drafts.push(...(await reminderDrafts(context, userId, accounts, today)))
  }
  return deliver(context, user, drafts)
}
