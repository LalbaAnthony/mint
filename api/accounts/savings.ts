import { Op } from 'sequelize'
import type { Transaction } from 'sequelize'
import { calculatedBalanceCents } from '@mint/shared/engines/balances'
import { computeForecast } from '@mint/shared/engines/forecast'
import {
  acquiredInterestCents,
  balanceExcludingInterest,
  currentRatePct,
  interestPeriodStart,
  nextCapitalization,
  upcomingCapitalization,
} from '@mint/shared/engines/interest'
import { isSavingsNature } from '@mint/shared/schemas/accounts'
import type {
  AccountInput,
  CreateAccountRequest,
  RegulatedProduct,
} from '@mint/shared/types/accounts'
import type { InterestSummary } from '@mint/shared/types/interest'
import type { Locale } from '@mint/shared/types/user'
import { parisDate } from '../clock.js'
import { loadForecastData } from '../forecast/views.js'
import {
  loadAccountInputs,
  loadInterestCategoryId,
  toOperationInput,
} from '../planning/inputs.js'
import type { AppDependencies } from '../types/app.js'
import type { AccountAttributes, AccountModel } from '../types/models.js'
import type { DataAccess } from '../types/planning.js'
import type { SavingsSummary } from '../types/savings.js'

const interestLabels: Record<Locale, string> = {
  fr: 'Intérêts',
  en: 'Interest',
}

export async function referenceCapCents(
  data: Pick<DataAccess, 'models'>,
  product: RegulatedProduct | null,
  transaction?: Transaction,
): Promise<number | null> {
  if (product === null) {
    return null
  }
  const cap = await data.models.RegulatedCap.findOne({
    where: { product },
    transaction,
  })
  return cap?.capCents ?? null
}

export async function savingsColumns(
  data: DataAccess,
  fields: CreateAccountRequest,
  previous: AccountModel | null,
  transaction?: Transaction,
): Promise<
  Pick<
    AccountAttributes,
    | 'depositCapCents'
    | 'capitalizedInterestCents'
    | 'interestMethod'
    | 'capitalization'
    | 'anniversaryDate'
  >
> {
  if (!isSavingsNature(fields.nature)) {
    return {
      depositCapCents: null,
      capitalizedInterestCents: null,
      interestMethod: null,
      capitalization: null,
      anniversaryDate: null,
    }
  }
  const productChanged = previous?.regulatedProduct !== fields.regulatedProduct
  const depositCapCents =
    fields.depositCapCents !== undefined
      ? fields.depositCapCents
      : previous !== null && !productChanged
        ? previous.depositCapCents
        : await referenceCapCents(data, fields.regulatedProduct, transaction)
  const capitalization =
    fields.capitalization ?? previous?.capitalization ?? 'dec31'
  return {
    depositCapCents,
    capitalizedInterestCents:
      fields.capitalizedInterestCents ??
      previous?.capitalizedInterestCents ??
      0,
    interestMethod:
      fields.interestMethod ?? previous?.interestMethod ?? 'fortnight',
    capitalization,
    anniversaryDate:
      capitalization === 'anniversary'
        ? (fields.anniversaryDate ?? previous?.anniversaryDate ?? null)
        : null,
  }
}

export async function syncInterestSchedule(
  data: Pick<AppDependencies, 'models' | 'clock'>,
  account: AccountModel,
  locale: Locale,
  transaction: Transaction,
): Promise<void> {
  const existing = await data.models.Schedule.findOne({
    where: { userId: account.userId, accountId: account.id, isSystem: true },
    transaction,
  })
  if (account.interestMethod === null || account.capitalization === null) {
    await existing?.destroy({ transaction })
    return
  }
  const startDate = nextCapitalization(
    {
      method: account.interestMethod,
      capitalization: account.capitalization,
      anniversaryDate: account.anniversaryDate,
      rates: [],
    },
    account.initialBalanceDate,
  )
  if (existing !== null) {
    if (existing.startDate !== startDate) {
      await existing.update({ startDate }, { transaction })
    }
    return
  }
  const categoryId = await loadInterestCategoryId(
    data,
    account.userId,
    transaction,
  )
  if (categoryId === null) {
    throw new Error(`User ${account.userId} has no interest category`)
  }
  await data.models.Schedule.create(
    {
      userId: account.userId,
      kind: 'income',
      label: interestLabels[locale],
      amountCents: 0,
      accountId: account.id,
      categoryId,
      triggerMode: 'auto',
      frequency: 'yearly',
      interval: 1,
      startDate,
      businessDayRule: 'exact',
      amountTolerancePct: 100,
      isSystem: true,
      createdOn: parisDate(data.clock.now()),
    },
    { transaction },
  )
}

function projectedInterest(
  forecast: ReturnType<typeof computeForecast> | null,
  accountId: string,
  date: string,
): number {
  const day = forecast?.accounts
    .find((candidate) => candidate.accountId === accountId)
    ?.days.find((candidate) => candidate.date === date)
  return (day?.flows ?? []).reduce(
    (total, flow) =>
      flow.source === 'occurrence' && flow.system
        ? total + flow.amountCents
        : total,
    0,
  )
}

function interestSummaryOf(
  account: AccountInput,
  operations: Parameters<typeof acquiredInterestCents>[1],
  today: string,
  interestCategoryId: string | null,
  forecast: ReturnType<typeof computeForecast> | null,
): InterestSummary | null {
  const settings = account.interest
  if (settings === null) {
    return null
  }
  const next = upcomingCapitalization(settings, today)
  return {
    annualRatePct: currentRatePct(settings, today),
    periodStart: interestPeriodStart(account, settings, today),
    acquiredCents: acquiredInterestCents(
      account,
      operations,
      today,
      interestCategoryId,
    ),
    nextCapitalizationDate: next,
    projectedCents: projectedInterest(forecast, account.id, next),
  }
}

export async function loadSavingsSummaries(
  data: DataAccess,
  userId: string,
  accounts: readonly AccountModel[],
  today: string,
  transaction?: Transaction,
): Promise<Map<string, SavingsSummary>> {
  const savingsIds = new Set(
    accounts
      .filter((account) => isSavingsNature(account.nature))
      .map((account) => account.id),
  )
  if (savingsIds.size === 0) {
    return new Map()
  }
  const inputs = (await loadAccountInputs(data, userId, transaction)).filter(
    (account) => savingsIds.has(account.id),
  )
  const interestCategoryId = await loadInterestCategoryId(
    data,
    userId,
    transaction,
  )
  const operations = (
    await data.models.Transaction.findAll({
      where: {
        userId,
        accountId: { [Op.in]: [...savingsIds] },
        date: { [Op.lte]: today },
      },
      transaction,
    })
  ).map(toOperationInput)
  const needsProjection = inputs.some(
    (account) =>
      !account.archived &&
      account.interest !== null &&
      account.interest.rates.length > 0,
  )
  const forecast = needsProjection
    ? computeForecast({
        today,
        horizonMonths: 12,
        ...(await loadForecastData(data, userId)),
      })
    : null
  return new Map(
    inputs.map((account) => {
      const balance = calculatedBalanceCents(account, operations, today)
      const excluding =
        balance === null || account.depositCapCents === null
          ? null
          : balanceExcludingInterest(
              account,
              operations,
              balance,
              today,
              interestCategoryId,
            )
      return [
        account.id,
        {
          interest: interestSummaryOf(
            account,
            operations,
            today,
            interestCategoryId,
            forecast,
          ),
          depositCapExcessCents:
            excluding === null ||
            account.depositCapCents === null ||
            excluding <= account.depositCapCents
              ? null
              : excluding - account.depositCapCents,
        },
      ]
    }),
  )
}
