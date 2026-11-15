import { calculatedBalanceCents } from '@mint/shared/engines/balances'
import { computeForecast } from '@mint/shared/engines/forecast'
import { balanceExcludingInterest } from '@mint/shared/engines/interest'
import type { CapWarning } from '@mint/shared/types/interest'
import type { Forecast } from '@mint/shared/types/forecast'
import type { ScheduleCapExcess } from '@mint/shared/types/schedules'
import type { CapAlert } from '@mint/shared/types/dashboard'
import { loadForecastData } from '../forecast/views.js'
import type { CapCheckedMovement } from '../types/savings.js'
import type { ForecastData } from '../types/forecast.js'
import type { DataAccess } from '../types/planning.js'

const capWarningHorizonMonths = 12

function hasCaps(forecastData: ForecastData): boolean {
  return forecastData.accounts.some(
    (account) => !account.archived && account.depositCapCents !== null,
  )
}

export async function loadCapForecast(
  data: DataAccess,
  userId: string,
  today: string,
  horizonMonths: number,
): Promise<Forecast | null> {
  const forecastData = await loadForecastData(data, userId)
  return hasCaps(forecastData)
    ? computeForecast({ today, horizonMonths, ...forecastData })
    : null
}

export function scheduleCapExcesses(
  forecast: Forecast | null,
): Map<string, ScheduleCapExcess> {
  const excesses = new Map<string, ScheduleCapExcess>()
  for (const account of forecast?.accounts ?? []) {
    for (const day of account.days) {
      for (const flow of day.flows) {
        if (
          flow.source !== 'occurrence' ||
          flow.capExcessCents === null ||
          (excesses.get(flow.scheduleId)?.effectiveDate ?? '9999-12-31') <=
            flow.effectiveDate
        ) {
          continue
        }
        excesses.set(flow.scheduleId, {
          originalDate: flow.originalDate,
          effectiveDate: flow.effectiveDate,
          excessCents: flow.capExcessCents,
        })
      }
    }
  }
  return excesses
}

export function capAlertsOf(forecast: Forecast | null): CapAlert[] {
  return (forecast?.accounts ?? []).flatMap((account) => {
    const first = account.days.find((day) => day.capExcessCents !== null)
    return first === undefined || first.capExcessCents === null
      ? []
      : [
          {
            accountId: account.accountId,
            date: first.date,
            excessCents: first.capExcessCents,
          },
        ]
  })
}

export async function capWarnings(
  data: DataAccess,
  userId: string,
  today: string,
  movements: readonly CapCheckedMovement[],
): Promise<CapWarning[]> {
  const credits = movements.filter((movement) => movement.amountCents > 0)
  if (credits.length === 0) {
    return []
  }
  const forecastData = await loadForecastData(data, userId)
  const capped = credits.flatMap((movement) => {
    const account = forecastData.accounts.find(
      (candidate) =>
        candidate.id === movement.accountId &&
        candidate.depositCapCents !== null,
    )
    return account === undefined ? [] : [{ movement, account }]
  })
  if (capped.length === 0) {
    return []
  }
  const forecast = capped.some(({ movement }) => movement.date > today)
    ? computeForecast({
        today,
        horizonMonths: capWarningHorizonMonths,
        ...forecastData,
      })
    : null
  return capped.flatMap(({ movement, account }) => {
    const capCents = account.depositCapCents ?? 0
    let excessCents: number | null = null
    if (movement.date <= today) {
      const balance = calculatedBalanceCents(
        account,
        forecastData.operations,
        movement.date,
      )
      const excluding =
        balance === null
          ? null
          : balanceExcludingInterest(
              account,
              forecastData.operations,
              balance,
              movement.date,
              forecastData.interestCategoryId,
            )
      excessCents =
        excluding !== null && excluding > capCents ? excluding - capCents : null
    } else {
      excessCents =
        forecast?.accounts
          .find((candidate) => candidate.accountId === account.id)
          ?.days.find((day) => day.date === movement.date)?.capExcessCents ??
        null
    }
    return excessCents === null
      ? []
      : [{ accountId: account.id, date: movement.date, excessCents }]
  })
}
