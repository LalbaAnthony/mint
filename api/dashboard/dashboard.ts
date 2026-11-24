import { Op } from 'sequelize'
import {
  addDays,
  addMonthsToMonth,
  monthEnd,
  monthStart,
} from '@mint/shared/engines/dates'
import { computeForecast } from '@mint/shared/engines/forecast'
import { upcomingManualPayments } from '@mint/shared/engines/notifications'
import {
  forecastMonthlyIncomeExpenses,
  monthlyIncomeExpenses,
  spendingBreakdown,
} from '@mint/shared/engines/reports'
import type {
  BalanceAlert,
  BreakdownQuery,
  BreakdownResponse,
  DashboardSummary,
  ManualPayment,
  MonthlyReport,
  MonthlyReportResponse,
} from '@mint/shared/types/dashboard'
import { loadForecastData } from '../forecast/views.js'
import {
  loadAccountInputs,
  loadCategoryInputs,
  toOperationInput,
} from '../planning/inputs.js'
import { loadManualOccurrences } from '../planning/manual.js'
import { capAlertsOf, loadCapForecast } from '../accounts/caps.js'
import type { UserModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'

export const alertWindowDays = 7

const realMonths = 12

async function periodOperations(
  data: DataAccess,
  userId: string,
  from: string,
  to: string,
) {
  const inPeriod = await data.models.Transaction.findAll({
    where: { userId, date: { [Op.between]: [from, to] } },
  })
  const groupIds = [
    ...new Set(
      inPeriod.flatMap((operation) => operation.transferGroupId ?? []),
    ),
  ]
  const known = new Set(inPeriod.map((operation) => operation.id))
  const counterparts =
    groupIds.length === 0
      ? []
      : await data.models.Transaction.findAll({
          where: { userId, transferGroupId: { [Op.in]: groupIds } },
        })
  return [
    ...inPeriod,
    ...counterparts.filter((operation) => !known.has(operation.id)),
  ].map(toOperationInput)
}

export async function breakdown(
  data: DataAccess,
  user: UserModel,
  query: BreakdownQuery,
  today: string,
): Promise<BreakdownResponse> {
  const from = query.from ?? monthStart(today)
  const to = query.to ?? monthEnd(today)
  const result = spendingBreakdown({
    from,
    to,
    operations: await periodOperations(data, user.id, from, to),
    categories: await loadCategoryInputs(data, user.id),
    accounts: await loadAccountInputs(data, user.id),
  })
  return {
    from,
    to,
    ...result,
    targets: {
      needs: user.targetNeedsPct,
      wants: user.targetWantsPct,
      save: user.targetSavePct,
    },
  }
}

export async function monthlyReport(
  data: DataAccess,
  user: UserModel,
  horizonMonths: number,
  today: string,
): Promise<MonthlyReportResponse> {
  const currentMonth = monthStart(today)
  const forecastData = await loadForecastData(data, user.id)
  const real = monthlyIncomeExpenses({
    fromMonth: addMonthsToMonth(currentMonth, 1 - realMonths),
    toMonth: currentMonth,
    operations: forecastData.operations.filter(
      (operation) => operation.date <= today,
    ),
    categories: forecastData.categories,
  })
  const planned = forecastData.accounts.some((account) => !account.archived)
    ? forecastMonthlyIncomeExpenses({
        forecast: computeForecast({ today, horizonMonths, ...forecastData }),
        operations: forecastData.operations,
        categories: forecastData.categories,
      })
    : []
  const months = new Map<string, MonthlyReport>()
  for (const month of real) {
    months.set(month.month, {
      month: month.month,
      real: {
        incomeCents: month.incomeCents,
        expenseCents: month.expenseCents,
      },
      planned: { incomeCents: 0, expenseCents: 0 },
      balanceCents: month.balanceCents,
    })
  }
  for (const month of planned) {
    const realPart = months.get(month.month)?.real ?? {
      incomeCents: 0,
      expenseCents: 0,
    }
    months.set(month.month, {
      month: month.month,
      real: realPart,
      planned: {
        incomeCents: month.incomeCents,
        expenseCents: month.expenseCents,
      },
      balanceCents:
        realPart.incomeCents - realPart.expenseCents + month.balanceCents,
    })
  }
  return {
    today,
    currentMonth,
    months: [...months.values()].sort((first, second) =>
      first.month.localeCompare(second.month),
    ),
  }
}

async function upcomingManualPaymentsOf(
  data: DataAccess,
  userId: string,
  today: string,
): Promise<ManualPayment[]> {
  const manual = await loadManualOccurrences(
    data,
    userId,
    await loadAccountInputs(data, userId),
    today,
  )
  return manual
    .flatMap(({ schedule, accountId, occurrences }) =>
      upcomingManualPayments(
        occurrences,
        schedule.reminderDaysBefore,
        today,
      ).map((occurrence) => ({ accountId, date: occurrence.effectiveDate })),
    )
    .sort(
      (first, second) =>
        first.date.localeCompare(second.date) ||
        first.accountId.localeCompare(second.accountId),
    )
}

export async function dashboardSummary(
  data: DataAccess,
  userId: string,
  today: string,
  horizonMonths: number,
): Promise<DashboardSummary> {
  const accounts = await data.models.Account.findAll({
    where: { userId, archivedAt: null },
  })
  const alerts: BalanceAlert[] = []
  if (accounts.some((account) => account.lowBalanceThresholdCents !== null)) {
    const forecastData = await loadForecastData(data, userId)
    const forecast = computeForecast({
      today,
      horizonMonths: 1,
      ...forecastData,
    })
    const windowEnd = addDays(today, alertWindowDays)
    for (const account of accounts) {
      const threshold = account.lowBalanceThresholdCents
      const projection = forecast.accounts.find(
        (candidate) => candidate.accountId === account.id,
      )
      if (threshold === null || projection === undefined) {
        continue
      }
      const window = projection.days.filter((day) => day.date <= windowEnd)
      const below = window.find((day) => day.balanceCents < threshold)
      if (below !== undefined) {
        alerts.push({
          accountId: account.id,
          firstBelowThresholdDate: below.date,
          minBalanceCents: Math.min(...window.map((day) => day.balanceCents)),
          thresholdCents: threshold,
        })
      }
    }
  }
  const pending = await data.models.ImportBatch.findAll({
    attributes: ['id'],
    where: { userId, status: 'pending' },
    order: [['createdAt', 'DESC']],
  })
  const pendingIds = pending.map((batch) => batch.id)
  const manualPayments = await upcomingManualPaymentsOf(data, userId, today)
  return {
    alerts,
    capAlerts: capAlertsOf(
      await loadCapForecast(data, userId, today, horizonMonths),
    ),
    manualPaymentsCount: manualPayments.length,
    nextManualPayment: manualPayments[0] ?? null,
    toCategorizeCount: await data.models.Transaction.count({
      where: { userId, status: 'to_categorize' },
    }),
    pendingProposalsCount:
      pendingIds.length === 0
        ? 0
        : await data.models.ImportRow.count({
            where: {
              batchId: { [Op.in]: pendingIds },
              proposedScheduleId: { [Op.ne]: null },
            },
          }),
    pendingImportIds: pendingIds,
  }
}
